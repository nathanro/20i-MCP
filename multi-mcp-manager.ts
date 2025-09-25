#!/usr/bin/env node

/**
 * Multi-MCP Manager
 * 
 * This manager handles multiple MCP servers in the same infrastructure,
 * providing load balancing, service discovery, and centralized monitoring.
 */

import { config } from 'dotenv';
config();

import { createServer, Server } from 'http';
import { Server as SocketServer } from 'socket.io';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface MCPInstance {
  id: string;
  name: string;
  description: string;
  status: 'healthy' | 'unhealthy' | 'starting' | 'stopping' | 'error';
  url: string;
  healthCheck: {
    path: string;
    interval: number;
    timeout: number;
    retries: number;
  };
  scaling: {
    minInstances: number;
    maxInstances: number;
    cpuThreshold: number;
    memoryThreshold: number;
  };
  routing: {
    path: string;
    methods: string[];
    rateLimit: {
      requests: number;
      window: string;
    };
  };
  lastHealthCheck: Date;
  consecutiveFailures: number;
}

interface MultiMCPConfig {
  mcpInstances: Record<string, MCPInstance>;
  sharedServices: {
    database: any;
    cache: any;
    monitoring: any;
  };
  networking: {
    ports: {
      http: number;
      https: number;
      metrics: number;
      grafana: number;
    };
  };
  security: {
    ssl: any;
    authentication: any;
    authorization: any;
    rateLimiting: any;
  };
  deployment: {
    strategy: string;
    rollingUpdate: any;
    healthChecks: any;
    restartPolicy: any;
  };
}

class MultiMCPManager {
  private config: MultiMCPConfig;
  private instances: Map<string, MCPInstance> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private server: Server;
  private io: SocketServer;
  private metrics: Map<string, any> = new Map();

  constructor() {
    this.config = this.loadConfig();
    this.server = createServer();
    this.io = new SocketServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.initializeInstances();
    this.setupEventHandlers();
    this.startHealthChecks();
    this.startMetricsCollection();
  }

  private loadConfig(): MultiMCPConfig {
    try {
      const configPath = join(process.cwd(), 'multi-mcp-config.json');
      const configData = readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('Failed to load configuration:', error);
      process.exit(1);
    }
  }

  private initializeInstances(): void {
    Object.entries(this.config.mcpInstances).forEach(([id, instanceConfig]) => {
      const instance: MCPInstance = {
        id,
        name: instanceConfig.name,
        description: instanceConfig.description,
        status: 'starting',
        url: `http://localhost:${instanceConfig.port}`,
        healthCheck: instanceConfig.healthCheck,
        scaling: instanceConfig.scaling,
        routing: instanceConfig.routing,
        lastHealthCheck: new Date(),
        consecutiveFailures: 0,
      };
      
      this.instances.set(id, instance);
      this.startInstance(id);
    });
  }

  private async startInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    try {
      instance.status = 'starting';
      this.io.emit('instance-status', { instanceId, status: instance.status });

      // Start Docker container for the instance
      await this.startDockerContainer(instanceId);
      
      instance.status = 'healthy';
      instance.consecutiveFailures = 0;
      instance.lastHealthCheck = new Date();
      
      this.io.emit('instance-status', { instanceId, status: instance.status });
      this.io.emit('instance-started', { instanceId, instance });
      
      console.log(`Instance ${instanceId} started successfully`);
    } catch (error) {
      instance.status = 'error';
      instance.consecutiveFailures++;
      this.io.emit('instance-status', { instanceId, status: instance.status });
      this.io.emit('instance-error', { instanceId, error: error.message });
      
      console.error(`Failed to start instance ${instanceId}:`, error);
    }
  }

  private async startDockerContainer(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    const instanceConfig = this.config.mcpInstances[instanceId];
    
    // Build Docker run command
    const envVars = Object.entries(instanceConfig.environment || {})
      .map(([key, value]) => `-e ${key}=${value}`)
      .join(' ');

    const command = `docker run -d --name ${instanceId} -p ${instanceConfig.port}:3000 ${envVars} ${instanceConfig.image}`;

    try {
      await execAsync(command);
      console.log(`Docker container for ${instanceId} started`);
    } catch (error) {
      if (error.message.includes('already in use')) {
        // Container already exists, restart it
        await execAsync(`docker restart ${instanceId}`);
      } else {
        throw error;
      }
    }
  }

  private async stopInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    try {
      instance.status = 'stopping';
      this.io.emit('instance-status', { instanceId, status: instance.status });

      await execAsync(`docker stop ${instanceId}`);
      await execAsync(`docker rm ${instanceId}`);
      
      instance.status = 'unhealthy';
      this.io.emit('instance-status', { instanceId, status: instance.status });
      this.io.emit('instance-stopped', { instanceId });
      
      console.log(`Instance ${instanceId} stopped successfully`);
    } catch (error) {
      instance.status = 'error';
      this.io.emit('instance-status', { instanceId, status: instance.status });
      this.io.emit('instance-error', { instanceId, error: error.message });
      
      console.error(`Failed to stop instance ${instanceId}:`, error);
    }
  }

  private startHealthChecks(): void {
    this.instances.forEach((instance, instanceId) => {
      const interval = setInterval(async () => {
        await this.performHealthCheck(instanceId);
      }, instance.healthCheck.interval * 1000);

      this.healthCheckIntervals.set(instanceId, interval);
    });
  }

  private async performHealthCheck(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    try {
      const response = await fetch(`${instance.url}${instance.healthCheck.path}`, {
        timeout: instance.healthCheck.timeout * 1000,
      });

      if (response.ok) {
        instance.status = 'healthy';
        instance.consecutiveFailures = 0;
        instance.lastHealthCheck = new Date();
      } else {
        instance.consecutiveFailures++;
        if (instance.consecutiveFailures >= instance.healthCheck.retries) {
          instance.status = 'unhealthy';
          await this.handleInstanceFailure(instanceId);
        }
      }
    } catch (error) {
      instance.consecutiveFailures++;
      if (instance.consecutiveFailures >= instance.healthCheck.retries) {
        instance.status = 'unhealthy';
        await this.handleInstanceFailure(instanceId);
      }
    }

    this.io.emit('instance-status', { instanceId, status: instance.status });
  }

  private async handleInstanceFailure(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    console.warn(`Instance ${instanceId} is unhealthy, attempting restart...`);
    
    try {
      await this.stopInstance(instanceId);
      await this.startInstance(instanceId);
    } catch (error) {
      console.error(`Failed to restart instance ${instanceId}:`, error);
    }
  }

  private startMetricsCollection(): void {
    setInterval(async () => {
      const metrics = await this.collectMetrics();
      this.metrics.set('system', metrics);
      this.io.emit('metrics', metrics);
    }, 30000); // Collect metrics every 30 seconds
  }

  private async collectMetrics(): Promise<any> {
    const metrics: any = {
      timestamp: new Date().toISOString(),
      instances: {},
      system: {},
    };

    // Collect instance metrics
    for (const [instanceId, instance] of this.instances) {
      try {
        const response = await fetch(`${instance.url}/metrics`, {
          timeout: 5000,
        });
        
        if (response.ok) {
          const instanceMetrics = await response.text();
          metrics.instances[instanceId] = {
            status: instance.status,
            lastHealthCheck: instance.lastHealthCheck.toISOString(),
            metrics: instanceMetrics,
          };
        } else {
          metrics.instances[instanceId] = {
            status: instance.status,
            lastHealthCheck: instance.lastHealthCheck.toISOString(),
            error: 'Failed to fetch metrics',
          };
        }
      } catch (error) {
        metrics.instances[instanceId] = {
          status: instance.status,
          lastHealthCheck: instance.lastHealthCheck.toISOString(),
          error: error.message,
        };
      }
    }

    // Collect system metrics
    try {
      const { stdout } = await execAsync('docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"');
      metrics.system.docker = stdout;
    } catch (error) {
      metrics.system.docker = error.message;
    }

    return metrics;
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Send current status to new client
      socket.emit('instances-status', Array.from(this.instances.entries()));

      // Handle instance control commands
      socket.on('start-instance', async (instanceId) => {
        await this.startInstance(instanceId);
      });

      socket.on('stop-instance', async (instanceId) => {
        await this.stopInstance(instanceId);
      });

      socket.on('restart-instance', async (instanceId) => {
        await this.stopInstance(instanceId);
        await this.startInstance(instanceId);
      });

      socket.on('get-metrics', () => {
        socket.emit('metrics', this.metrics.get('system'));
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    // Handle HTTP requests for API
    this.server.on('request', (req, res) => {
      this.handleHttpRequest(req, res);
    });
  }

  private async handleHttpRequest(req: any, res: any): Promise<void> {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // Handle health check
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        instances: Array.from(this.instances.entries()).map(([id, instance]) => ({
          id,
          name: instance.name,
          status: instance.status,
          lastHealthCheck: instance.lastHealthCheck.toISOString(),
        })),
      }));
      return;
    }

    // Handle metrics endpoint
    if (url.pathname === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.metrics.get('system') || {}));
      return;
    }

    // Handle WebSocket upgrade
    if (req.url === '/socket.io/') {
      return;
    }

    // Handle API requests
    if (url.pathname.startsWith('/api/')) {
      const instanceId = url.pathname.split('/')[2];
      const instance = this.instances.get(instanceId);
      
      if (!instance) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Instance not found' }));
        return;
      }

      if (instance.status !== 'healthy') {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Instance is not healthy' }));
        return;
      }

      // Proxy request to instance
      try {
        const proxyUrl = `${instance.url}${url.pathname.replace(`/api/${instanceId}`, '')}${url.search}`;
        const proxyResponse = await fetch(proxyUrl, {
          method: req.method,
          headers: req.headers,
          body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
        });

        res.writeHead(proxyResponse.status, proxyResponse.headers);
        res.end(await proxyResponse.text());
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to proxy request' }));
      }
      return;
    }

    // Default response
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  public start(port: number = 8080): void {
    this.server.listen(port, () => {
      console.log(`Multi-MCP Manager started on port ${port}`);
      console.log(`Health checks running for ${this.instances.size} instances`);
      console.log(`WebSocket server available on ws://localhost:${port}`);
    });
  }

  public async shutdown(): Promise<void> {
    console.log('Shutting down Multi-MCP Manager...');
    
    // Stop all instances
    for (const instanceId of this.instances.keys()) {
      await this.stopInstance(instanceId);
    }

    // Clear health check intervals
    this.healthCheckIntervals.forEach((interval) => {
      clearInterval(interval);
    });

    // Close server
    this.server.close();
    
    console.log('Multi-MCP Manager shutdown complete');
  }
}

// Start the manager
const manager = new MultiMCPManager();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await manager.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await manager.shutdown();
  process.exit(0);
});

// Start the server
const port = parseInt(process.env.PORT || '8080');
manager.start(port);