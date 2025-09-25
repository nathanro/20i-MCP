import { config } from 'dotenv';
config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 20i MCP Server - Main Entry Point
 *
 * This is the main entry point for the MCP server that runs both the MCP protocol
 * and the web interface for managing MCP tools.
 */

// Create MCP server instance
const server = new Server(
  {
    name: '20i-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Health check server
async function startHealthCheckServer() {
  const port = process.env.PORT || 10000;

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    server.listen(port, () => {
      console.error(`Health check server listening on port ${port}`);
      resolve(server);
    });

    server.on('error', (error) => {
      console.error('Health check server error:', error);
      reject(error);
    });
  });
}

// Import and start web server
import { app } from './web-server-simple.js';

async function main() {
  try {
    console.error('20i MCP Server starting...');
    
    // Start health check server first
    await startHealthCheckServer();
    console.error('Health check server started');

    // Then start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP server connected via stdio');
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});