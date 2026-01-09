/**
 * UserConnectionDO - Durable Object for Global User WebSocket Connection
 *
 * Each user gets ONE Durable Object instance that:
 * - Maintains a single WebSocket connection
 * - Receives updates from ALL conversations the user is in
 * - Queues messages to KV when user is offline
 * - Broadcasts messages, typing indicators, presence, read receipts
 * - Survives DO hibernation via KV persistence
 */

import type { Env } from '../types/env';

// WebSocket message types
type WSMessageType = 'message' | 'typing' | 'presence' | 'read' | 'ping' | 'pong' | 'connected' | 'error';

interface WSMessage {
  type: WSMessageType;
  conversationId?: string;
  payload?: any;
  timestamp?: string;
}

// Rate limit configuration
interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  message: { windowMs: 60000, maxRequests: 60 },     // 60 messages per minute
  typing: { windowMs: 10000, maxRequests: 20 },      // 20 typing events per 10 seconds
  default: { windowMs: 60000, maxRequests: 100 },    // 100 other actions per minute
};

export class UserConnectionDO {
  private ctx: DurableObjectState;
  private env: Env;
  private userId: string = '';
  private userName: string = '';
  private socket: WebSocket | null = null;
  private userConversations: Set<string> = new Set();
  private lastPing: number = Date.now();
  private rateLimiters: Map<string, RateLimitRecord> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;

    // Set alarm for periodic cleanup
    this.ctx.storage.setAlarm(Date.now() + 60000); // 1 minute
  }

  /**
   * Handle WebSocket upgrade and internal notifications
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle internal notifications from ChatRoomDO
    if (url.pathname === '/notify' && request.method === 'POST') {
      return await this.handleNotification(request);
    }

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // Extract user info from query params
    const userId = url.searchParams.get('userId');
    const userName = url.searchParams.get('userName');

    if (!userId || !userName) {
      return new Response('Missing authentication parameters', { status: 401 });
    }

    this.userId = userId;
    this.userName = userName;

    // Load user's conversations from database
    await this.loadUserConversations();

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept WebSocket
    this.ctx.acceptWebSocket(server);
    this.socket = server;

    console.log(`[UserConnectionDO] User ${userName} (${userId}) connected. Conversations: ${this.userConversations.size}`);

    // Send connected confirmation
    this.send({
      type: 'connected',
      payload: {
        userId,
        conversationsCount: this.userConversations.size,
        timestamp: new Date().toISOString(),
      },
    });

    // Flush any queued messages from when user was offline
    await this.flushQueuedMessages();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Check rate limit for specific message type
   * Returns true if request is allowed, false if rate limit exceeded
   */
  private checkRateLimit(messageType: string): boolean {
    const config = RATE_LIMITS[messageType] || RATE_LIMITS.default;
    const key = `${this.userId}:${messageType}`;
    const now = Date.now();

    const record = this.rateLimiters.get(key);

    if (!record || record.resetAt < now) {
      // No record or window expired - create new window
      this.rateLimiters.set(key, {
        count: 1,
        resetAt: now + config.windowMs,
      });
      return true;
    }

    if (record.count >= config.maxRequests) {
      // Rate limit exceeded
      return false;
    }

    // Increment count
    record.count++;
    return true;
  }

  /**
   * Clean up expired rate limit records
   */
  private cleanupRateLimiters(): void {
    const now = Date.now();
    for (const [key, record] of this.rateLimiters.entries()) {
      if (record.resetAt < now) {
        this.rateLimiters.delete(key);
      }
    }
  }

  /**
   * Handle WebSocket messages from client
   */
  async webSocketMessage(_ws: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    try {
      const message: WSMessage = typeof rawMessage === 'string'
        ? JSON.parse(rawMessage)
        : JSON.parse(new TextDecoder().decode(rawMessage as ArrayBuffer));

      this.lastPing = Date.now();

      // Skip rate limiting for ping/pong keepalive
      if (message.type !== 'ping' && message.type !== 'pong') {
        // Check rate limit BEFORE processing
        if (!this.checkRateLimit(message.type)) {
          const config = RATE_LIMITS[message.type] || RATE_LIMITS.default;
          const resetIn = Math.ceil(config.windowMs / 1000);

          console.warn(
            `[UserConnectionDO] Rate limit exceeded for user ${this.userId}, type: ${message.type}`
          );

          this.send({
            type: 'error',
            payload: {
              message: `Rate limit exceeded. Please slow down. (${config.maxRequests} ${message.type}s per ${resetIn}s)`,
              code: 'RATE_LIMIT',
              resetIn,
            },
          });
          return;
        }
      }

      switch (message.type) {
        case 'ping':
          this.send({ type: 'pong', timestamp: new Date().toISOString() });
          break;

        case 'message':
          // Forward message to ChatRoomDO for processing and broadcast
          await this.forwardMessage(message);
          break;

        case 'typing':
          // Forward typing indicator to ChatRoomDO for broadcast
          await this.forwardTypingIndicator(message);
          break;

        default:
          console.warn(`[UserConnectionDO] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('[UserConnectionDO] Error handling WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(_ws: WebSocket, code: number, reason: string, _wasClean: boolean): Promise<void> {
    console.log(`[UserConnectionDO] User ${this.userName} disconnected: code=${code}, reason=${reason}`);
    this.socket = null;
  }

  /**
   * Handle WebSocket error
   */
  async webSocketError(_ws: WebSocket, error: Error): Promise<void> {
    console.error('[UserConnectionDO] WebSocket error:', error);
  }

  /**
   * Handle internal notifications from ChatRoomDO
   */
  private async handleNotification(request: Request): Promise<Response> {
    try {
      const data = await request.json() as any;
      const { type, conversationId, payload } = data;

      // Check if user is in this conversation
      if (!this.userConversations.has(conversationId)) {
        return new Response('User not in conversation', { status: 403 });
      }

      // Queue or send message
      await this.queueMessage({
        type,
        conversationId,
        payload,
        timestamp: new Date().toISOString(),
      });

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('[UserConnectionDO] Error handling notification:', error);
      return new Response('Internal error', { status: 500 });
    }
  }

  /**
   * Load user's conversations from database
   */
  private async loadUserConversations(): Promise<void> {
    try {
      const result = await this.env.DB.prepare(
        `SELECT conversation_id FROM conversation_participants
         WHERE user_id = ? AND left_at IS NULL`
      )
        .bind(this.userId)
        .all();

      this.userConversations.clear();
      (result.results || []).forEach((row: any) => {
        this.userConversations.add(row.conversation_id);
      });

      console.log(`[UserConnectionDO] Loaded ${this.userConversations.size} conversations for user ${this.userId}`);
    } catch (error) {
      console.error('[UserConnectionDO] Error loading conversations:', error);
    }
  }

  /**
   * Queue message (sends immediately if online, stores in KV if offline)
   * ADDED: DO storage fallback if KV fails
   */
  private async queueMessage(message: WSMessage): Promise<void> {
    if (this.socket && this.socket.readyState === 1) { // WebSocket.OPEN = 1
      // User online, send immediately
      this.send(message);
    } else {
      // User offline, persist to KV (with DO storage fallback)
      const queueKey = this.getQueueKey();

      try {
        const existingQueue = await this.env.CACHE.get(queueKey, 'json') as WSMessage[] || [];
        existingQueue.push({ ...message, queuedAt: Date.now() } as any);

        // Keep last 100 messages, expire after 7 days
        const trimmed = existingQueue.slice(-100);
        await this.env.CACHE.put(
          queueKey,
          JSON.stringify(trimmed),
          { expirationTtl: 604800 } // 7 days
        );

        console.log(`[UserConnectionDO] Queued message to KV for offline user ${this.userId} (${trimmed.length} in queue)`);
      } catch (kvError) {
        console.error('[UserConnectionDO] KV queue failed, using DO storage fallback:', kvError);

        // ADDED: Fallback to Durable Object storage (more expensive but reliable)
        try {
          const doQueueKey = `message_queue:${this.userId}`;
          const existingDoQueue = (await this.ctx.storage.get(doQueueKey)) as WSMessage[] || [];
          existingDoQueue.push({ ...message, queuedAt: Date.now() } as any);

          // Keep last 50 messages (DO storage more limited)
          const trimmedDoQueue = existingDoQueue.slice(-50);
          await this.ctx.storage.put(doQueueKey, trimmedDoQueue);

          console.log(`[UserConnectionDO] Queued message to DO storage for user ${this.userId} (${trimmedDoQueue.length} in queue)`);
        } catch (doError) {
          console.error('[UserConnectionDO] DO storage fallback also failed:', doError);
          // Absolute last resort: Message will be lost, but don't crash
        }
      }
    }
  }

  /**
   * Flush queued messages when user reconnects
   * ADDED: Also flush from DO storage fallback
   */
  private async flushQueuedMessages(): Promise<void> {
    const messages: WSMessage[] = [];

    // Try KV first
    const queueKey = this.getQueueKey();
    try {
      const kvQueue = await this.env.CACHE.get(queueKey, 'json') as WSMessage[] || [];
      messages.push(...kvQueue);
      await this.env.CACHE.delete(queueKey);
    } catch (error) {
      console.error('[UserConnectionDO] Failed to read KV queue:', error);
    }

    // Also check DO storage fallback
    const doQueueKey = `message_queue:${this.userId}`;
    try {
      const doQueue = (await this.ctx.storage.get(doQueueKey)) as WSMessage[] || [];
      messages.push(...doQueue);
      await this.ctx.storage.delete(doQueueKey);
    } catch (error) {
      console.error('[UserConnectionDO] Failed to read DO storage queue:', error);
    }

    if (messages.length > 0) {
      // Deduplicate by messageId/timestamp (in case same message in both queues)
      const uniqueMessages = Array.from(
        new Map(messages.map(m => [m.payload?.id || m.timestamp, m])).values()
      );

      console.log(
        `[UserConnectionDO] Flushing ${uniqueMessages.length} queued messages for user ${this.userId} (${messages.length} total, ${messages.length - uniqueMessages.length} duplicates removed)`
      );

      // Sort by timestamp and send
      uniqueMessages
        .sort((a: any, b: any) => (a.queuedAt || 0) - (b.queuedAt || 0))
        .forEach(message => this.send(message));
    }
  }

  /**
   * Send message to user's WebSocket
   */
  private send(message: WSMessage): void {
    if (!this.socket || this.socket.readyState !== 1) { // WebSocket.OPEN = 1
      return;
    }

    try {
      this.socket.send(JSON.stringify({
        ...message,
        timestamp: message.timestamp || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('[UserConnectionDO] Error sending message:', error);
    }
  }

  /**
   * Forward message to ChatRoomDO for processing
   */
  private async forwardMessage(message: WSMessage): Promise<void> {
    if (!message.conversationId) {
      this.send({
        type: 'error',
        payload: { message: 'conversationId is required for messages' },
      });
      return;
    }

    // Check if user is in this conversation
    if (!this.userConversations.has(message.conversationId)) {
      this.send({
        type: 'error',
        payload: { message: 'Access denied to this conversation' },
      });
      return;
    }

    try {
      // Get ChatRoomDO for this conversation
      const roomId = this.env.CHAT_ROOMS.idFromName(message.conversationId);
      const roomStub = this.env.CHAT_ROOMS.get(roomId);

      // Forward message to room for processing
      const response = await roomStub.fetch(
        new Request('http://internal/message', {
          method: 'POST',
          body: JSON.stringify({
            userId: this.userId,
            userName: this.userName,
            conversationId: message.conversationId,
            content: message.payload?.content,
            messageType: message.payload?.messageType || 'text',
            metadata: message.payload?.metadata,
            tempId: message.payload?.tempId,
          }),
        })
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error('[UserConnectionDO] Error forwarding message:', error);
      this.send({
        type: 'error',
        payload: {
          message: 'Failed to send message',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Forward typing indicator to ChatRoomDO
   */
  private async forwardTypingIndicator(message: WSMessage): Promise<void> {
    if (!message.conversationId) {
      console.warn('[UserConnectionDO] Typing indicator missing conversationId');
      return;
    }

    try {
      // Get ChatRoomDO for this conversation
      const roomId = this.env.CHAT_ROOMS.idFromName(message.conversationId);
      const roomStub = this.env.CHAT_ROOMS.get(roomId);

      // Notify room about typing
      await roomStub.fetch(
        new Request('http://internal/typing', {
          method: 'POST',
          body: JSON.stringify({
            userId: this.userId,
            userName: this.userName,
            isTyping: message.payload?.isTyping || false,
          }),
        })
      );
    } catch (error) {
      console.error('[UserConnectionDO] Error forwarding typing indicator:', error);
    }
  }

  /**
   * Get KV queue key for this user
   */
  private getQueueKey(): string {
    return `user:${this.userId}:message_queue`;
  }

  /**
   * Alarm handler for periodic cleanup
   */
  async alarm(): Promise<void> {
    // Check if connection is stale (no ping in 2 minutes)
    const now = Date.now();
    const staleThreshold = 120000; // 2 minutes

    if (this.socket && (now - this.lastPing) > staleThreshold) {
      console.log(`[UserConnectionDO] Closing stale connection for user ${this.userId}`);
      try {
        this.socket.close(1001, 'Connection stale');
      } catch (error) {
        console.error('[UserConnectionDO] Error closing stale connection:', error);
      }
      this.socket = null;
    }

    // Clean up expired rate limit records
    this.cleanupRateLimiters();
    if (this.rateLimiters.size > 0) {
      console.log(`[UserConnectionDO] Active rate limiters for user ${this.userId}: ${this.rateLimiters.size}`);
    }

    // Set next alarm
    await this.ctx.storage.setAlarm(Date.now() + 60000); // 1 minute
  }
}

export default UserConnectionDO;
