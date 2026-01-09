import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import type { Env, Variables } from './types/env';

// Routes
import authRoutes from './routes/auth';
import customFormsRoutes from './routes/custom-forms';
import userRoutes from './routes/users';
import conversationRoutes from './routes/conversations';
import presenceRoutes from './routes/presence';
import chatSyncRoutes from './routes/chat-sync';
import uploadsRoutes from './routes/uploads';
import filesRoutes from './routes/files';
import websocketRoutes from './routes/websocket';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================================
// GLOBAL MIDDLEWARE
// ============================================================================

// Logger - log all requests
app.use('*', logger());

// Pretty JSON - format JSON responses
app.use('*', prettyJSON());

// CORS - configure cross-origin requests
app.use('*', cors({
  origin: (origin: string) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://cgiworkflo-monorepo.pages.dev',
      'https://cgiworkflo.pages.dev',
      'https://cgiworkflo.com',
      'https://www.cgiworkflo.com',
    ];
    // Allow origin if it's in the list or is a pages.dev subdomain
    if (allowedOrigins.includes(origin) || origin.endsWith('.pages.dev')) {
      return origin;
    }
    return allowedOrigins[0];
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,
  credentials: true,
}));

// ============================================================================
// HEALTH & STATUS ENDPOINTS
// ============================================================================

app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
    version: c.env.API_VERSION,
  });
});

app.get('/api/version', (c) => {
  return c.json({
    version: c.env.API_VERSION || '1.0.0',
    environment: c.env.ENVIRONMENT,
  });
});

// ============================================================================
// API ROUTES
// ============================================================================

// Authentication routes (public)
app.route('/api/auth', authRoutes);

// Custom Forms routes (protected)
app.route('/api/custom-forms', customFormsRoutes);

// User management routes (protected, admin only)
app.route('/api/users', userRoutes);

// Conversation and messaging routes (protected)
app.route('/api/conversations', conversationRoutes);

// Presence tracking routes (protected)
app.route('/api/presence', presenceRoutes);

// Chat sync route for efficient polling (protected)
app.route('/api/chat', chatSyncRoutes);

// WebSocket routes for real-time chat (protected)
app.route('/api/ws', websocketRoutes);

// File upload routes (protected)
app.route('/api/uploads', uploadsRoutes);

// File serving routes (public - serves uploaded files from R2)
app.route('/files', filesRoutes);

// TODO: Register additional routes as they are implemented
// import aarRoutes from './routes/aars';
// import categoryRoutes from './routes/categories';
// import analyticsRoutes from './routes/analytics';

// app.route('/api/users', userRoutes);
// app.route('/api/aars', aarRoutes);
// app.route('/api/conversations', messageRoutes);
// app.route('/api/categories', categoryRoutes);
// app.route('/api/analytics', analyticsRoutes);

// Temporary stub routes (to be replaced)
app.get('/api/aars', (c) => {
  return c.json({
    message: 'AARs endpoint - To be implemented',
    data: [],
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      path: c.req.path,
      message: `The endpoint ${c.req.path} does not exist`,
    },
    404
  );
});

// Global error handler
app.onError((err, c) => {
  console.error('Error:', err);

  // Check if it's an HTTP exception with a status
  if ('status' in err && typeof err.status === 'number') {
    return c.json(
      {
        error: err.message,
        details: 'cause' in err ? err.cause : undefined,
      },
      err.status as any
    );
  }

  // Default 500 error
  return c.json(
    {
      error: 'Internal Server Error',
      message: c.env.ENVIRONMENT === 'development' ? err.message : 'An unexpected error occurred',
    },
    500 as any
  );
});

// ============================================================================
// EXPORT
// ============================================================================

export default app;

// Export Durable Objects
export { ChatRoomDO } from './durable-objects/ChatRoomDO';
export { UserConnectionDO } from './durable-objects/UserConnectionDO';
