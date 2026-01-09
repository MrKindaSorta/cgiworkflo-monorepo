/**
 * WebSocket Routes
 * Handles WebSocket upgrade requests and proxies to Durable Objects
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { nanoid } from 'nanoid';
import { authenticate } from '../middleware/auth';
import type { Env, Variables } from '../types/env';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================================
// WEBSOCKET UPGRADE ROUTE
// ============================================================================

/**
 * GET /ws/chat/:conversationId
 * Upgrade HTTP connection to WebSocket and proxy to Durable Object
 */
app.get('/chat/:conversationId', authenticate, async (c) => {
  try {
    const user = c.get('user');
    const { conversationId } = c.req.param();

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // Check if this is a WebSocket upgrade request
    const upgradeHeader = c.req.header('Upgrade');
    if (upgradeHeader !== 'websocket') {
      throw new HTTPException(426, { message: 'Expected WebSocket upgrade' });
    }

    // Verify user has access to this conversation
    const participant = await c.env.DB.prepare(
      `SELECT id FROM conversation_participants
       WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL`
    )
      .bind(conversationId, user.id)
      .first();

    if (!participant) {
      throw new HTTPException(403, { message: 'Access denied to this conversation' });
    }

    // Get user's name for the connection
    const userRecord = await c.env.DB.prepare(
      `SELECT name FROM users WHERE id = ?`
    )
      .bind(user.id)
      .first();

    const userName = (userRecord?.name as string) || 'Unknown User';

    // Generate unique connection ID
    const connectionId = nanoid();

    // Get Durable Object stub for this conversation
    const doId = c.env.CHAT_ROOMS.idFromName(conversationId);
    const doStub = c.env.CHAT_ROOMS.get(doId);

    // Create URL with user info for the DO
    const doUrl = new URL(c.req.url);
    doUrl.searchParams.set('userId', user.id);
    doUrl.searchParams.set('userName', userName);
    doUrl.searchParams.set('connectionId', connectionId);

    // Forward the request to the Durable Object
    const doResponse = await doStub.fetch(doUrl.toString(), c.req.raw);

    return doResponse;
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    console.error('Error upgrading to WebSocket:', error);
    throw new HTTPException(500, { message: 'Failed to establish WebSocket connection' });
  }
});

// ============================================================================
// WEBSOCKET STATUS/HEALTH CHECK
// ============================================================================

/**
 * GET /ws/health
 * Check WebSocket service health
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'websocket',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /ws/connections/:conversationId
 * Get active connections for a conversation (admin/debugging)
 */
app.get('/connections/:conversationId', authenticate, async (c) => {
  try {
    const user = c.get('user');
    const { conversationId } = c.req.param();

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // Get active connections from database
    const connections = await c.env.DB.prepare(
      `SELECT
         wc.id as connectionId,
         wc.user_id as userId,
         u.name as userName,
         strftime('%Y-%m-%dT%H:%M:%SZ', wc.connected_at) as connectedAt,
         strftime('%Y-%m-%dT%H:%M:%SZ', wc.last_ping) as lastPing
       FROM websocket_connections wc
       JOIN users u ON wc.user_id = u.id
       WHERE wc.conversation_id = ?
       ORDER BY wc.connected_at DESC`
    )
      .bind(conversationId)
      .all();

    return c.json({
      success: true,
      data: {
        conversationId,
        activeConnections: connections.results || [],
        count: (connections.results || []).length,
      },
    });
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    console.error('Error fetching connections:', error);
    throw new HTTPException(500, { message: 'Failed to fetch connections' });
  }
});

export default app;
