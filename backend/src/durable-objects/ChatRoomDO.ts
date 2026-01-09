/**
 * ChatRoomDO - Durable Object for Chat Room WebSocket Management
 *
 * Each conversation gets its own Durable Object instance that:
 * - Manages WebSocket connections for all participants
 * - Broadcasts messages in real-time
 * - Tracks typing indicators
 * - Handles presence updates
 * - Syncs read receipts
 * - Manages reconnections and offline queueing
 */

import type { Env } from '../types/env';

// WebSocket message types
type WSMessageType = 'message' | 'typing' | 'presence' | 'read' | 'error' | 'ping' | 'pong' | 'connected' | 'participant_joined' | 'participant_left';

interface WSMessage {
  type: WSMessageType;
  payload?: any;
  timestamp?: string;
}

interface Connection {
  socket: WebSocket;
  userId: string;
  userName: string;
  connectionId: string;
  connectedAt: Date;
  lastPing: Date;
}

export class ChatRoomDO {
  private ctx: DurableObjectState;
  private env: Env;
  private connections: Map<string, Connection> = new Map();
  private conversationId: string = '';
  private typingUsers: Map<string, number> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;

    // Start cleanup interval for stale connections
    this.startCleanupInterval();
  }

  /**
   * Handle WebSocket upgrade and internal requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle internal message request from UserConnectionDO
    if (url.pathname === '/message' && request.method === 'POST') {
      return await this.handleInternalMessage(request);
    }

    // Handle internal typing request from UserConnectionDO
    if (url.pathname === '/typing' && request.method === 'POST') {
      return await this.handleInternalTyping(request);
    }

    // Check if this is a WebSocket upgrade request
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // Extract user info and conversation ID from query params
    const userId = url.searchParams.get('userId');
    const userName = url.searchParams.get('userName');
    const connectionId = url.searchParams.get('connectionId');
    const conversationId = url.searchParams.get('conversationId');

    if (!userId || !userName || !connectionId || !conversationId) {
      return new Response('Missing authentication parameters', { status: 401 });
    }

    // Set conversation ID if not already set
    if (!this.conversationId) {
      this.conversationId = conversationId;
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    this.ctx.acceptWebSocket(server);

    // Store connection info
    const connection: Connection = {
      socket: server,
      userId,
      userName,
      connectionId,
      connectedAt: new Date(),
      lastPing: new Date(),
    };

    this.connections.set(connectionId, connection);

    console.log(`[ChatRoomDO] User ${userName} (${userId}) connected to conversation ${this.conversationId}. Total connections: ${this.connections.size}`);

    // Send connected confirmation
    this.sendToConnection(connectionId, {
      type: 'connected',
      payload: {
        conversationId: this.conversationId,
        connectionId,
        timestamp: new Date().toISOString(),
      },
    });

    // Notify others about new participant
    this.broadcast({
      type: 'participant_joined',
      payload: {
        userId,
        userName,
        timestamp: new Date().toISOString(),
      },
    }, connectionId); // Exclude the new connection itself

    // Track connection in database
    await this.trackConnectionInDB(connectionId, userId);

    // Return the client WebSocket
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle internal message request from UserConnectionDO
   */
  private async handleInternalMessage(request: Request): Promise<Response> {
    try {
      const data = await request.json() as any;
      const { userId, userName, conversationId, content, messageType, metadata, tempId } = data;

      // Set conversation ID if not set
      if (!this.conversationId) {
        this.conversationId = conversationId;
      }

      // Validate message
      if (!content || content.trim().length === 0) {
        return new Response('Message content cannot be empty', { status: 400 });
      }

      // Save message to database
      const messageId = await this.saveMessageToDB({
        conversationId: this.conversationId,
        senderId: userId,
        content,
        messageType: messageType || 'text',
        metadata,
      });

      // Prepare broadcast payload
      const broadcastPayload = {
        id: messageId,
        conversationId: this.conversationId,
        senderId: userId,
        senderName: userName,
        content,
        messageType: messageType || 'text',
        metadata,
        timestamp: new Date().toISOString(),
        tempId,
      };

      // Notify all participants via their UserConnectionDO
      await this.notifyParticipants('message', broadcastPayload);

      console.log(`[ChatRoomDO] Message ${messageId} sent by ${userName} via UserConnectionDO`);

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('[ChatRoomDO] Error handling internal message:', error);
      return new Response(error instanceof Error ? error.message : 'Internal error', { status: 500 });
    }
  }

  /**
   * Handle internal typing indicator from UserConnectionDO
   */
  private async handleInternalTyping(request: Request): Promise<Response> {
    try {
      const data = await request.json() as any;
      const { userId, userName, isTyping } = data;

      // Notify all participants except sender
      const participants = await this.getConversationParticipants();
      const otherParticipants = participants.filter(id => id !== userId);

      await Promise.allSettled(
        otherParticipants.map(participantId =>
          this.notifyParticipant(participantId, 'typing', {
            userId,
            userName,
            isTyping,
          })
        )
      );

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('[ChatRoomDO] Error handling internal typing:', error);
      return new Response('Internal error', { status: 500 });
    }
  }

  /**
   * Handle WebSocket messages
   */
  async webSocketMessage(ws: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    try {
      // Find connection by socket
      const connection = Array.from(this.connections.values()).find(conn => conn.socket === ws);

      if (!connection) {
        console.error('[ChatRoomDO] Received message from unknown connection');
        return;
      }

      // Parse message
      const message: WSMessage = typeof rawMessage === 'string'
        ? JSON.parse(rawMessage)
        : JSON.parse(new TextDecoder().decode(rawMessage as ArrayBuffer));

      console.log(`[ChatRoomDO] Received message type ${message.type} from user ${connection.userId}`);

      // Update last activity
      connection.lastPing = new Date();

      // Handle different message types
      switch (message.type) {
        case 'ping':
          this.handlePing(connection);
          break;

        case 'message':
          await this.handleNewMessage(connection, message.payload);
          break;

        case 'typing':
          this.handleTyping(connection, message.payload);
          break;

        case 'read':
          await this.handleReadReceipt(connection, message.payload);
          break;

        case 'presence':
          this.handlePresenceUpdate(connection, message.payload);
          break;

        default:
          console.warn(`[ChatRoomDO] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('[ChatRoomDO] Error handling WebSocket message:', error);
      this.sendToSocket(ws, {
        type: 'error',
        payload: {
          message: 'Failed to process message',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): Promise<void> {
    // Find and remove connection
    const entry = Array.from(this.connections.entries()).find(([_, conn]) => conn.socket === ws);

    if (entry) {
      const [connectionId, connection] = entry;

      console.log(`[ChatRoomDO] User ${connection.userName} (${connection.userId}) disconnected from conversation ${this.conversationId}. Code: ${code}, Reason: ${reason}`);

      // Clean up typing indicator if user was typing
      this.clearTypingIndicator(connection.userId);

      // Remove from connections map
      this.connections.delete(connectionId);

      // Notify others about participant leaving
      this.broadcast({
        type: 'participant_left',
        payload: {
          userId: connection.userId,
          userName: connection.userName,
          timestamp: new Date().toISOString(),
        },
      });

      // Remove from database
      await this.removeConnectionFromDB(connectionId);

      console.log(`[ChatRoomDO] Remaining connections: ${this.connections.size}`);
    }
  }

  /**
   * Handle WebSocket error
   */
  async webSocketError(ws: WebSocket, error: Error): Promise<void> {
    console.error('[ChatRoomDO] WebSocket error:', error);

    // Close the connection
    try {
      ws.close(1011, 'Internal error');
    } catch (e) {
      console.error('[ChatRoomDO] Error closing WebSocket:', e);
    }
  }

  // ============================================================================
  // MESSAGE HANDLERS
  // ============================================================================

  /**
   * Handle ping messages for keepalive
   */
  private handlePing(connection: Connection): void {
    this.sendToConnection(connection.connectionId, {
      type: 'pong',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle new chat message
   */
  private async handleNewMessage(connection: Connection, payload: any): Promise<void> {
    try {
      const { content, messageType = 'text', metadata, tempId } = payload;

      // Validate message
      if (!content || content.trim().length === 0) {
        throw new Error('Message content cannot be empty');
      }

      // Save message to database
      const messageId = await this.saveMessageToDB({
        conversationId: this.conversationId,
        senderId: connection.userId,
        content,
        messageType,
        metadata,
      });

      // Broadcast to all connections in this conversation
      const broadcastPayload = {
        id: messageId,
        conversationId: this.conversationId,
        senderId: connection.userId,
        senderName: connection.userName,
        content,
        messageType,
        metadata,
        timestamp: new Date().toISOString(),
        tempId, // Include tempId so client can replace optimistic message
      };

      this.broadcast({
        type: 'message',
        payload: broadcastPayload,
      });

      // Notify all participants via their UserConnectionDO (for users not in active WebSocket)
      await this.notifyParticipants('message', broadcastPayload);

      // Clear typing indicator for sender
      this.clearTypingIndicator(connection.userId);

      console.log(`[ChatRoomDO] Message ${messageId} sent by ${connection.userName} in conversation ${this.conversationId}`);
    } catch (error) {
      console.error('[ChatRoomDO] Error handling new message:', error);
      this.sendToConnection(connection.connectionId, {
        type: 'error',
        payload: {
          message: 'Failed to send message',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Handle typing indicator
   */
  private handleTyping(connection: Connection, payload: any): void {
    const { isTyping } = payload;

    if (isTyping) {
      // Clear existing timeout
      const existingTimeout = this.typingUsers.get(connection.userId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout (auto-clear after 5 seconds)
      const timeout = setTimeout(() => {
        this.clearTypingIndicator(connection.userId);
      }, 5000);

      this.typingUsers.set(connection.userId, timeout);

      // Broadcast typing indicator to others
      this.broadcast({
        type: 'typing',
        payload: {
          userId: connection.userId,
          userName: connection.userName,
          isTyping: true,
        },
      }, connection.connectionId); // Exclude sender
    } else {
      this.clearTypingIndicator(connection.userId);
    }
  }

  /**
   * Clear typing indicator for a user
   */
  private clearTypingIndicator(userId: string): void {
    const timeout = this.typingUsers.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.typingUsers.delete(userId);

      // Broadcast typing stopped
      this.broadcast({
        type: 'typing',
        payload: {
          userId,
          isTyping: false,
        },
      });
    }
  }

  /**
   * Handle read receipt
   */
  private async handleReadReceipt(connection: Connection, payload: any): Promise<void> {
    try {
      const { messageId } = payload;

      if (!messageId) {
        throw new Error('messageId is required for read receipts');
      }

      // Update database with read receipt
      await this.saveReadReceiptToDB(messageId, connection.userId);

      // Broadcast read receipt to all participants
      this.broadcast({
        type: 'read',
        payload: {
          messageId,
          userId: connection.userId,
          userName: connection.userName,
          readAt: new Date().toISOString(),
        },
      });

      console.log(`[ChatRoomDO] User ${connection.userName} read message ${messageId}`);
    } catch (error) {
      console.error('[ChatRoomDO] Error handling read receipt:', error);
    }
  }

  /**
   * Handle presence update
   */
  private handlePresenceUpdate(connection: Connection, payload: any): void {
    // Broadcast presence update
    this.broadcast({
      type: 'presence',
      payload: {
        userId: connection.userId,
        userName: connection.userName,
        status: payload.status || 'online',
        timestamp: new Date().toISOString(),
      },
    }, connection.connectionId); // Exclude sender
  }

  // ============================================================================
  // BROADCAST & SEND UTILITIES
  // ============================================================================

  /**
   * Broadcast message to all connections in this conversation
   */
  private broadcast(message: WSMessage, excludeConnectionId?: string): void {
    const messageStr = JSON.stringify({
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
    });

    let sentCount = 0;
    for (const [connectionId, connection] of this.connections.entries()) {
      if (excludeConnectionId && connectionId === excludeConnectionId) {
        continue;
      }

      try {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(messageStr);
          sentCount++;
        }
      } catch (error) {
        console.error(`[ChatRoomDO] Error broadcasting to connection ${connectionId}:`, error);
      }
    }

    console.log(`[ChatRoomDO] Broadcast message type ${message.type} to ${sentCount} connections`);
  }

  /**
   * Send message to specific connection
   */
  private sendToConnection(connectionId: string, message: WSMessage): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.sendToSocket(connection.socket, message);
    }
  }

  /**
   * Send message to specific socket
   */
  private sendToSocket(socket: WebSocket, message: WSMessage): void {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          ...message,
          timestamp: message.timestamp || new Date().toISOString(),
        }));
      }
    } catch (error) {
      console.error('[ChatRoomDO] Error sending to socket:', error);
    }
  }

  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  /**
   * Save new message to database
   */
  private async saveMessageToDB(data: {
    conversationId: string;
    senderId: string;
    content: string;
    messageType: string;
    metadata?: any;
  }): Promise<string> {
    const { nanoid } = await import('nanoid');
    const messageId = nanoid();

    const metadataStr = data.metadata ? JSON.stringify(data.metadata) : null;

    await this.env.DB.prepare(
      `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(messageId, data.conversationId, data.senderId, data.content, data.messageType, metadataStr)
      .run();

    // Update conversation's last_message_at
    await this.env.DB.prepare(
      `UPDATE conversations
       SET last_message_id = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(messageId, data.conversationId)
      .run();

    // Increment unread count for other participants
    await this.env.DB.prepare(
      `UPDATE conversation_participants
       SET unread_count = unread_count + 1
       WHERE conversation_id = ? AND user_id != ? AND left_at IS NULL`
    )
      .bind(data.conversationId, data.senderId)
      .run();

    return messageId;
  }

  /**
   * Save read receipt to database
   */
  private async saveReadReceiptToDB(messageId: string, userId: string): Promise<void> {
    // Get current read_by array
    const result = await this.env.DB.prepare(
      `SELECT read_by FROM messages WHERE id = ?`
    )
      .bind(messageId)
      .first();

    if (!result) {
      throw new Error('Message not found');
    }

    const readBy = result.read_by ? JSON.parse(result.read_by as string) : [];

    // Check if user already marked as read
    const existingIndex = readBy.findIndex((r: any) => r.userId === userId);

    if (existingIndex === -1) {
      // Add new read receipt
      readBy.push({
        userId,
        readAt: new Date().toISOString(),
      });

      // Update message
      await this.env.DB.prepare(
        `UPDATE messages SET read_by = ? WHERE id = ?`
      )
        .bind(JSON.stringify(readBy), messageId)
        .run();
    }

    // Update user's last_read_at in conversation_participants
    await this.env.DB.prepare(
      `UPDATE conversation_participants
       SET last_read_at = CURRENT_TIMESTAMP, unread_count = 0
       WHERE conversation_id = (SELECT conversation_id FROM messages WHERE id = ?)
         AND user_id = ?`
    )
      .bind(messageId, userId)
      .run();
  }

  /**
   * Track WebSocket connection in database
   */
  private async trackConnectionInDB(connectionId: string, userId: string): Promise<void> {
    try {
      await this.env.DB.prepare(
        `INSERT INTO websocket_connections (id, user_id, conversation_id, connected_at, last_ping)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
        .bind(connectionId, userId, this.conversationId)
        .run();
    } catch (error) {
      console.error('[ChatRoomDO] Error tracking connection in DB:', error);
    }
  }

  /**
   * Remove WebSocket connection from database
   */
  private async removeConnectionFromDB(connectionId: string): Promise<void> {
    try {
      await this.env.DB.prepare(
        `DELETE FROM websocket_connections WHERE id = ?`
      )
        .bind(connectionId)
        .run();
    } catch (error) {
      console.error('[ChatRoomDO] Error removing connection from DB:', error);
    }
  }

  // ============================================================================
  // CLEANUP & MAINTENANCE
  // ============================================================================

  /**
   * Start cleanup interval for stale connections
   */
  private startCleanupInterval(): void {
    // Set initial alarm for cleanup (1 minute from now)
    this.ctx.storage.setAlarm(Date.now() + 60000);
  }

  /**
   * Clean up stale connections (no ping in last 2 minutes)
   */
  private cleanupStaleConnections(): void {
    const now = new Date();
    const staleThreshold = 120000; // 2 minutes

    for (const [connectionId, connection] of this.connections.entries()) {
      const timeSinceLastPing = now.getTime() - connection.lastPing.getTime();

      if (timeSinceLastPing > staleThreshold) {
        console.log(`[ChatRoomDO] Cleaning up stale connection ${connectionId} for user ${connection.userName}`);

        try {
          connection.socket.close(1001, 'Connection stale');
        } catch (error) {
          console.error('[ChatRoomDO] Error closing stale connection:', error);
        }

        this.connections.delete(connectionId);
        this.removeConnectionFromDB(connectionId);
      }
    }
  }

  // ============================================================================
  // USER CONNECTION NOTIFICATIONS
  // ============================================================================

  /**
   * Notify all participants via their UserConnectionDO
   */
  private async notifyParticipants(type: string, payload: any): Promise<void> {
    try {
      // Get all participants for this conversation
      const participants = await this.getConversationParticipants();

      if (participants.length === 0) {
        return;
      }

      // For large groups (>10 participants), use batching
      if (participants.length > 10) {
        await this.notifyParticipantsBatched(participants, type, payload);
      } else {
        // Small groups: notify individually
        await Promise.allSettled(
          participants.map(participantId =>
            this.notifyParticipant(participantId, type, payload)
          )
        );
      }
    } catch (error) {
      console.error('[ChatRoomDO] Error notifying participants:', error);
    }
  }

  /**
   * Get all participants for this conversation
   */
  private async getConversationParticipants(): Promise<string[]> {
    try {
      const result = await this.env.DB.prepare(
        `SELECT user_id FROM conversation_participants
         WHERE conversation_id = ? AND left_at IS NULL`
      )
        .bind(this.conversationId)
        .all();

      return (result.results || []).map((row: any) => row.user_id);
    } catch (error) {
      console.error('[ChatRoomDO] Error getting participants:', error);
      return [];
    }
  }

  /**
   * Notify a single participant via their UserConnectionDO
   */
  private async notifyParticipant(userId: string, type: string, payload: any): Promise<void> {
    try {
      const userDOId = this.env.USER_CONNECTIONS.idFromName(userId);
      const userDOStub = this.env.USER_CONNECTIONS.get(userDOId);

      await userDOStub.fetch(
        new Request('http://internal/notify', {
          method: 'POST',
          body: JSON.stringify({
            type,
            conversationId: this.conversationId,
            payload,
          }),
        })
      );
    } catch (error) {
      // Log but don't fail - user might be offline
      console.debug(`[ChatRoomDO] Failed to notify user ${userId}:`, error);
    }
  }

  /**
   * Notify participants in batches (for large groups)
   */
  private async notifyParticipantsBatched(participants: string[], type: string, payload: any): Promise<void> {
    // Batch into groups of 10
    const batches: string[][] = [];
    for (let i = 0; i < participants.length; i += 10) {
      batches.push(participants.slice(i, i + 10));
    }

    console.log(`[ChatRoomDO] Notifying ${participants.length} participants in ${batches.length} batches`);

    // Process all batches in parallel
    await Promise.allSettled(
      batches.map(batch =>
        Promise.allSettled(
          batch.map(participantId =>
            this.notifyParticipant(participantId, type, payload)
          )
        )
      )
    );
  }

  /**
   * Alarm handler for periodic cleanup
   */
  async alarm(): Promise<void> {
    console.log('[ChatRoomDO] Alarm triggered for periodic cleanup');

    // Clean up stale connections
    this.cleanupStaleConnections();

    // Clean up old typing indicators
    for (const [userId, timeout] of this.typingUsers.entries()) {
      // If typing indicator is older than 10 seconds, clear it
      clearTimeout(timeout);
      this.clearTypingIndicator(userId);
    }

    // If no connections remain, set alarm to hibernate this DO in 5 minutes
    if (this.connections.size === 0) {
      await this.ctx.storage.setAlarm(Date.now() + 300000);
    } else {
      // Otherwise, set next alarm in 1 minute
      await this.ctx.storage.setAlarm(Date.now() + 60000);
    }
  }
}

export default ChatRoomDO;
