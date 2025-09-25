import express, { Request, Response } from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { TwentyIClient } from './core/client.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// In-memory user storage (in production, use a database)
const users = [
  {
    id: 1,
    username: 'admin',
    password: bcrypt.hashSync('admin123', 10)
  }
];

// MCP Server instance
let mcpServer: Server | null = null;
let twentyIClient: TwentyIClient | null = null;
let isMcpConnected = false;

// Authentication middleware
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

// Routes
app.post('/api/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  const user = users.find(u => u.username === username);
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  req.session.userId = user.id;
  res.json({ success: true, username: user.username });
});

app.post('/api/logout', (req: Request, res: Response) => {
  req.session.destroy((err: any) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.get('/api/auth/status', (req: Request, res: Response) => {
  if (req.session && req.session.userId) {
    const user = users.find(u => u.id === req.session.userId);
    res.json({ authenticated: true, username: user?.username });
  } else {
    res.json({ authenticated: false });
  }
});

// MCP Server management
app.post('/api/mcp/connect', requireAuth, async (req: Request, res: Response) => {
  try {
    if (isMcpConnected) {
      return res.json({ success: true, message: 'MCP server already connected' });
    }

    twentyIClient = new TwentyIClient();

    mcpServer = new Server(
      {
        name: '20i-mcp-server-web',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Handle tool listing
    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: await getAvailableTools()
      };
    });

    // Handle tool execution
    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return await executeTool(name, args);
    });

    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    
    isMcpConnected = true;
    io.emit('mcp-status', { connected: true });
    
    res.json({ success: true, message: 'MCP server connected successfully' });
  } catch (error) {
    console.error('Failed to connect MCP server:', error);
    res.status(500).json({ error: 'Failed to connect MCP server' });
  }
});

app.post('/api/mcp/disconnect', requireAuth, (req: Request, res: Response) => {
  if (mcpServer) {
    mcpServer.close();
    mcpServer = null;
  }
  twentyIClient = null;
  isMcpConnected = false;
  io.emit('mcp-status', { connected: false });
  res.json({ success: true, message: 'MCP server disconnected' });
});

app.get('/api/mcp/status', requireAuth, (req: Request, res: Response) => {
  res.json({ connected: isMcpConnected });
});

// Tools management
app.get('/api/tools', requireAuth, async (req: Request, res: Response) => {
  try {
    const tools = await getAvailableTools();
    res.json({ tools });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tools' });
  }
});

app.post('/api/tools/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const { toolName, arguments: args } = req.body;
    
    if (!isMcpConnected || !twentyIClient) {
      return res.status(400).json({ error: 'MCP server not connected' });
    }
    
    const result = await executeTool(toolName, args);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to test tool', details: error.message });
  }
});

// Helper functions
async function getAvailableTools(): Promise<Tool[]> {
  if (!isMcpConnected || !mcpServer) {
    return [];
  }
  
  try {
    const result = await mcpServer.request(ListToolsRequestSchema, {});
    return result.tools || [];
  } catch (error) {
    console.error('Error getting tools:', error);
    return [];
  }
}

async function executeTool(name: string, args: any) {
  if (!isMcpConnected || !mcpServer) {
    throw new Error('MCP server not connected');
  }
  
  try {
    const result = await mcpServer.request(CallToolRequestSchema, {
      name,
      arguments: args
    });
    return result;
  } catch (error) {
    console.error('Error executing tool:', error);
    throw error;
  }
}

// Serve the web interface
app.get('/', (req: Request, res: Response) => {
  res.sendFile(process.cwd() + '/public/index.html');
});

// Socket.IO for real-time updates
io.on('connection', (socket: Socket) => {
  console.log('Client connected');
  
  socket.emit('mcp-status', { connected: isMcpConnected });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

export { app, httpServer, io };