/**
 * WebSocket Routes
 * Handles WebSocket upgrade requests and proxies to Durable Objects
 *
 * SECURITY: Uses short-lived auth codes instead of JWT tokens in URLs
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { nanoid } from 'nanoid';
import { authenticate } from '../middleware/auth';
import type { Env, Variables } from '../types/env';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================================
// AUTH CODE EXCHANGE - Secure WebSocket Authentication
// ============================================================================

/**
 * POST /ws/auth-code
 * Generate short-lived auth code for WebSocket connection
 * Prevents JWT exposure in WebSocket URLs
 */
app.post('/auth-code', authenticate, async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      console.error('[WebSocket] No user in context after authenticate middleware');
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    console.log(`[WebSocket] Generating auth code for user ${user.id}`);

    // Generate unique auth code
    const authCode = nanoid(32);
    console.log(`[WebSocket] Generated code: ${authCode.substring(0, 8)}...`);

    // Store code in KV with 30-second expiration
    const codeKey = `ws:authcode:${authCode}`;
    const codeData = {
      userId: user.id,
      email: user.email,
      role: user.role,
      franchiseId: user.franchiseId || null,
      createdAt: Date.now(),
    };

    console.log(`[WebSocket] Storing code in KV with key: ${codeKey}`);

    await c.env.CACHE.put(
      codeKey,
      JSON.stringify(codeData),
      { expirationTtl: 60 } // 60 seconds (KV minimum)
    );

    console.log(`[WebSocket] Successfully generated auth code for user ${user.id}`);

    return c.json({
      success: true,
      data: {
        code: authCode,
        expiresIn: 60, // seconds (KV minimum TTL)
      },
    });
  } catch (error: any) {
    console.error('[WebSocket] Error generating auth code:', error);
    console.error('[WebSocket] Error stack:', error.stack);

    if (error instanceof HTTPException) throw error;

    throw new HTTPException(500, {
      message: `Failed to generate auth code: ${error.message || 'Unknown error'}`,
    });
  }
});

// ============================================================================
// WEBSOCKET UPGRADE ROUTES
// ============================================================================

/**
 * GET /ws/user
 * Global WebSocket connection for user - receives updates from ALL conversations
 * Uses short-lived auth code instead of JWT token for security
 */
app.get('/user', async (c) => {
  try {
    // Authenticate using auth code (NOT JWT token)
    const authCode = c.req.query('code');

    if (!authCode) {
      throw new HTTPException(401, { message: 'Unauthorized: No auth code provided' });
    }

    // Retrieve and delete auth code (single-use)
    const codeKey = `ws:authcode:${authCode}`;
    const codeData = await c.env.CACHE.get(codeKey, 'json') as any;

    if (!codeData) {
      throw new HTTPException(401, { message: 'Unauthorized: Invalid or expired auth code' });
    }

    // Delete code immediately (single-use)
    await c.env.CACHE.delete(codeKey);

    // Verify code is not too old (additional safety check)
    const codeAge = Date.now() - (codeData.createdAt || 0);
    if (codeAge > 65000) { // 65 seconds (5s grace period beyond 60s TTL)
      throw new HTTPException(401, { message: 'Unauthorized: Auth code expired' });
    }

    const user = {
      id: codeData.userId,
      email: codeData.email,
      role: codeData.role,
      franchiseId: codeData.franchiseId,
    };

    // Get user's name from database
    const userRecord = await c.env.DB.prepare(
      `SELECT name FROM users WHERE id = ?`
    )
      .bind(user.id)
      .first();

    const userName = (userRecord?.name as string) || 'Unknown User';

    // Check if this is a WebSocket upgrade request
    const upgradeHeader = c.req.header('Upgrade');
    if (upgradeHeader !== 'websocket') {
      throw new HTTPException(426, { message: 'Expected WebSocket upgrade' });
    }

    // Get UserConnectionDO for this user
    const doId = c.env.USER_CONNECTIONS.idFromName(user.id);
    const doStub = c.env.USER_CONNECTIONS.get(doId);

    // Create URL with user info for the DO
    const doUrl = new URL(c.req.url);
    doUrl.searchParams.set('userId', user.id);
    doUrl.searchParams.set('userName', userName);

    // Forward the request to the Durable Object
    const doResponse = await doStub.fetch(doUrl.toString(), c.req.raw);

    return doResponse;
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    console.error('Error upgrading to WebSocket:', error);
    throw new HTTPException(500, { message: 'Failed to establish WebSocket connection' });
  }
});

/**
 * GET /ws/chat/:conversationId
 * Upgrade HTTP connection to WebSocket and proxy to Durable Object
 * NOTE: This route is deprecated - use /ws/user for global connection
 * Uses short-lived auth code for security
 */
app.get('/chat/:conversationId', async (c) => {
  try {
    const { conversationId } = c.req.param();

    // Authenticate using auth code (NOT JWT token)
    const authCode = c.req.query('code');

    if (!authCode) {
      throw new HTTPException(401, { message: 'Unauthorized: No auth code provided' });
    }

    // Retrieve and delete auth code (single-use)
    const codeKey = `ws:authcode:${authCode}`;
    const codeData = await c.env.CACHE.get(codeKey, 'json') as any;

    if (!codeData) {
      throw new HTTPException(401, { message: 'Unauthorized: Invalid or expired auth code' });
    }

    // Delete code immediately (single-use)
    await c.env.CACHE.delete(codeKey);

    // Verify code is not too old (additional safety check)
    const codeAge = Date.now() - (codeData.createdAt || 0);
    if (codeAge > 65000) { // 65 seconds (5s grace period beyond 60s TTL)
      throw new HTTPException(401, { message: 'Unauthorized: Auth code expired' });
    }

    const user = {
      id: codeData.userId,
      email: codeData.email,
      role: codeData.role,
      franchiseId: codeData.franchiseId,
    };

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

    // Create URL with user info and conversation ID for the DO
    const doUrl = new URL(c.req.url);
    doUrl.searchParams.set('userId', user.id);
    doUrl.searchParams.set('userName', userName);
    doUrl.searchParams.set('connectionId', connectionId);
    doUrl.searchParams.set('conversationId', conversationId); // Pass actual DB conversation ID

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
