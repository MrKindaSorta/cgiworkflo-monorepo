/**
 * Conversations & Messaging Routes
 * Handles DMs, groups, open chat, and message management
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import type { Env, Variables } from '../types/env';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
app.use('*', authenticate);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createConversationSchema = z.object({
  type: z.enum(['direct', 'group']),
  name: z.string().optional(),
  participantIds: z.array(z.string()).min(1),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  messageType: z.enum(['text', 'image', 'file', 'system']).default('text'),
  metadata: z.string().optional(),
});

const addParticipantSchema = z.object({
  userId: z.string(),
});

// ============================================================================
// CONVERSATION ROUTES
// ============================================================================

/**
 * GET /api/conversations
 * List all conversations for current user
 */
app.get('/', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // Get all conversations user is part of
    const conversations = await db
      .prepare(
        `SELECT
          c.id,
          c.type,
          c.name,
          c.created_by as createdBy,
          c.last_message_id as lastMessageId,
          strftime('%Y-%m-%dT%H:%M:%SZ', c.last_message_at) as lastMessageAt,
          strftime('%Y-%m-%dT%H:%M:%SZ', c.created_at) as createdAt,
          cp.unread_count as unreadCount,
          strftime('%Y-%m-%dT%H:%M:%SZ', cp.last_read_at) as lastReadAt,
          (
            SELECT json_group_array(
              json_object(
                'userId', user_id,
                'joinedAt', strftime('%Y-%m-%dT%H:%M:%SZ', joined_at),
                'leftAt', strftime('%Y-%m-%dT%H:%M:%SZ', left_at)
              )
            )
            FROM conversation_participants
            WHERE conversation_id = c.id AND left_at IS NULL
          ) as participants
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE cp.user_id = ?
          AND cp.left_at IS NULL
          AND c.deleted_at IS NULL
        ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`
      )
      .bind(user.id)
      .all();

    return c.json({
      success: true,
      data: (conversations.results || []).map((conv: any) => ({
        ...conv,
        participants: conv.participants ? JSON.parse(conv.participants) : [],
      })),
    });
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    console.error('Error fetching conversations:', error);
    throw new HTTPException(500, { message: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/conversations/open
 * Get or create the global open chat conversation
 * IMPORTANT: Must be before /:id route
 */
app.get('/open', async (c) => {
  try {
    const db = c.env.DB;

    // Find existing open chat
    const openChat = await db
      .prepare(`SELECT id FROM conversations WHERE type = 'open' AND deleted_at IS NULL LIMIT 1`)
      .first();

    if (openChat) {
      return c.json({
        success: true,
        data: { id: openChat.id },
      });
    }

    // Create open chat if it doesn't exist
    const conversationId = nanoid();
    const timestamp = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO conversations (id, type, name, created_at, updated_at)
        VALUES (?, 'open', 'Open Chat', ?, ?)`
      )
      .bind(conversationId, timestamp, timestamp)
      .run();

    return c.json({
      success: true,
      data: { id: conversationId },
    });
  } catch (error: any) {
    console.error('Error getting open chat:', error);
    throw new HTTPException(500, { message: 'Failed to get open chat' });
  }
});

/**
 * GET /api/conversations/:id
 * Get single conversation details
 */
app.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id');
    const db = c.env.DB;

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // Verify user is participant
    const participant = await db
      .prepare(
        `SELECT id FROM conversation_participants
        WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL`
      )
      .bind(conversationId, user.id)
      .first();

    if (!participant) {
      throw new HTTPException(404, { message: 'Conversation not found or access denied' });
    }

    // Get conversation with all participants
    const conversation = await db
      .prepare(
        `SELECT
          c.id,
          c.type,
          c.name,
          c.created_by as createdBy,
          strftime('%Y-%m-%dT%H:%M:%SZ', c.created_at) as createdAt,
          (
            SELECT json_group_array(
              json_object(
                'userId', cp.user_id,
                'unreadCount', cp.unread_count,
                'lastReadAt', strftime('%Y-%m-%dT%H:%M:%SZ', cp.last_read_at),
                'joinedAt', strftime('%Y-%m-%dT%H:%M:%SZ', cp.joined_at),
                'userName', u.name,
                'userEmail', u.email
              )
            )
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = c.id AND cp.left_at IS NULL
          ) as participants
        FROM conversations c
        WHERE c.id = ? AND c.deleted_at IS NULL`
      )
      .bind(conversationId)
      .first();

    if (!conversation) {
      throw new HTTPException(404, { message: 'Conversation not found' });
    }

    return c.json({
      success: true,
      data: {
        ...conversation,
        participants: conversation.participants ? JSON.parse(conversation.participants as string) : [],
      },
    });
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    console.error('Error fetching conversation:', error);
    throw new HTTPException(500, { message: 'Failed to fetch conversation' });
  }
});

/**
 * POST /api/conversations
 * Create new conversation (DM or Group)
 */
app.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validated = createConversationSchema.parse(body);
    const db = c.env.DB;

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // Validation: group must have name
    if (validated.type === 'group' && !validated.name) {
      throw new HTTPException(400, { message: 'Group conversations require a name' });
    }

    // Validation: DM must have exactly 1 other participant
    if (validated.type === 'direct' && validated.participantIds.length !== 1) {
      throw new HTTPException(400, { message: 'Direct messages must have exactly 1 participant' });
    }

    // For DMs, check if conversation already exists
    if (validated.type === 'direct') {
      const otherUserId = validated.participantIds[0];

      const existing = await db
        .prepare(
          `SELECT c.id
          FROM conversations c
          WHERE c.type = 'direct'
            AND c.deleted_at IS NULL
            AND EXISTS (
              SELECT 1 FROM conversation_participants cp1
              WHERE cp1.conversation_id = c.id AND cp1.user_id = ? AND cp1.left_at IS NULL
            )
            AND EXISTS (
              SELECT 1 FROM conversation_participants cp2
              WHERE cp2.conversation_id = c.id AND cp2.user_id = ? AND cp2.left_at IS NULL
            )`
        )
        .bind(user.id, otherUserId)
        .first();

      if (existing) {
        return c.json({
          success: true,
          data: { id: existing.id },
          existed: true,
        });
      }
    }

    // Create conversation
    const conversationId = nanoid();
    const timestamp = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO conversations (id, type, name, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(conversationId, validated.type, validated.name || null, user.id, timestamp, timestamp)
      .run();

    // Add all participants (including creator)
    const allParticipants = [user.id, ...validated.participantIds];

    for (const userId of allParticipants) {
      const participantId = nanoid();
      await db
        .prepare(
          `INSERT INTO conversation_participants (id, conversation_id, user_id, joined_at)
          VALUES (?, ?, ?, ?)`
        )
        .bind(participantId, conversationId, userId, timestamp)
        .run();
    }

    return c.json({
      success: true,
      data: { id: conversationId },
      created: true,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Validation error',
        cause: error.errors,
      });
    }
    if (error instanceof HTTPException) throw error;
    console.error('Error creating conversation:', error);
    throw new HTTPException(500, { message: 'Failed to create conversation' });
  }
});

// ============================================================================
// MESSAGE ROUTES
// ============================================================================

/**
 * GET /api/conversations/:id/messages
 * Get messages for a conversation (paginated with differential updates)
 */
app.get('/:id/messages', async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id');
    const db = c.env.DB;

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // Query params
    const limit = parseInt(c.req.query('limit') || '50');
    const before = c.req.query('before'); // Message ID for pagination
    const since = c.req.query('since'); // Timestamp for differential updates

    // Verify user is participant (or it's open chat)
    const conversation = await db
      .prepare(`SELECT type FROM conversations WHERE id = ? AND deleted_at IS NULL`)
      .bind(conversationId)
      .first();

    if (!conversation) {
      throw new HTTPException(404, { message: 'Conversation not found' });
    }

    // For non-open chats, verify participant
    if (conversation.type !== 'open') {
      const participant = await db
        .prepare(
          `SELECT id FROM conversation_participants
          WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL`
        )
        .bind(conversationId, user.id)
        .first();

      if (!participant) {
        throw new HTTPException(403, { message: 'Access denied' });
      }
    }

    // Build query with optional filters
    let query = `
      SELECT
        m.id,
        m.conversation_id as conversationId,
        m.sender_id as senderId,
        m.content,
        m.message_type as messageType,
        m.metadata,
        strftime('%Y-%m-%dT%H:%M:%SZ', m.created_at) as timestamp,
        u.name as senderName
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
        AND m.deleted_at IS NULL
    `;

    const bindings: any[] = [conversationId];

    // Differential update: only fetch messages since timestamp
    if (since) {
      query += ` AND m.created_at > ?`;
      bindings.push(since);
    }

    // Pagination: fetch messages before a certain message
    if (before) {
      const beforeMsg = await db.prepare('SELECT created_at FROM messages WHERE id = ?').bind(before).first();

      if (beforeMsg) {
        query += ` AND m.created_at < ?`;
        bindings.push(beforeMsg.created_at);
      }
    }

    query += ` ORDER BY m.created_at DESC LIMIT ?`;
    bindings.push(limit);

    const messages = await db.prepare(query).bind(...bindings).all();

    return c.json({
      success: true,
      data: (messages.results || []).reverse(), // Oldest first for display
      hasMore: messages.results.length === limit,
    });
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    console.error('Error fetching messages:', error);
    throw new HTTPException(500, { message: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/conversations/:id/messages
 * Send a message
 * Rate limited to 60 messages per minute
 */
app.post(
  '/:id/messages',
  rateLimit({ windowMs: 60000, maxRequests: 60 }),
  async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id');
    const body = await c.req.json();
    const validated = sendMessageSchema.parse(body);
    const db = c.env.DB;

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // Verify conversation exists
    const conversation = await db
      .prepare(`SELECT type FROM conversations WHERE id = ? AND deleted_at IS NULL`)
      .bind(conversationId)
      .first();

    if (!conversation) {
      throw new HTTPException(404, { message: 'Conversation not found' });
    }

    // For non-open chats, verify user is participant
    if (conversation.type !== 'open') {
      const participant = await db
        .prepare(
          `SELECT id FROM conversation_participants
          WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL`
        )
        .bind(conversationId, user.id)
        .first();

      if (!participant) {
        throw new HTTPException(403, { message: 'Access denied' });
      }
    }

    // Create message
    const messageId = nanoid();
    const timestamp = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(messageId, conversationId, user.id, validated.content, validated.messageType, validated.metadata || null, timestamp, timestamp)
      .run();

    // Triggers will automatically:
    // 1. Update conversation.last_message_id and last_message_at
    // 2. Increment unread_count for all participants except sender

    // Fetch created message with sender info
    const message = await db
      .prepare(
        `SELECT
          m.id,
          m.conversation_id as conversationId,
          m.sender_id as senderId,
          m.content,
          m.message_type as messageType,
          m.metadata,
          strftime('%Y-%m-%dT%H:%M:%SZ', m.created_at) as timestamp,
          u.name as senderName
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?`
      )
      .bind(messageId)
      .first();

    return c.json({
      success: true,
      data: message,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Validation error',
        cause: error.errors,
      });
    }
    if (error instanceof HTTPException) throw error;
    console.error('Error sending message:', error);
    throw new HTTPException(500, { message: 'Failed to send message' });
  }
});

/**
 * PATCH /api/conversations/:id/read
 * Mark conversation as read (reset unread count)
 */
app.patch('/:id/read', async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id');
    const db = c.env.DB;

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    await db
      .prepare(
        `UPDATE conversation_participants
        SET unread_count = 0,
            last_read_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE conversation_id = ? AND user_id = ?`
      )
      .bind(conversationId, user.id)
      .run();

    return c.json({ success: true });
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    console.error('Error marking as read:', error);
    throw new HTTPException(500, { message: 'Failed to mark as read' });
  }
});

// ============================================================================
// PARTICIPANT MANAGEMENT
// ============================================================================

/**
 * POST /api/conversations/:id/participants
 * Add user to group conversation
 */
app.post('/:id/participants', async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id');
    const body = await c.req.json();
    const validated = addParticipantSchema.parse(body);
    const db = c.env.DB;

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // Verify conversation is a group
    const conversation = await db
      .prepare(`SELECT type FROM conversations WHERE id = ? AND deleted_at IS NULL`)
      .bind(conversationId)
      .first();

    if (!conversation) {
      throw new HTTPException(404, { message: 'Conversation not found' });
    }

    if (conversation.type !== 'group') {
      throw new HTTPException(400, { message: 'Can only add participants to groups' });
    }

    // Verify requester is participant
    const isParticipant = await db
      .prepare(
        `SELECT id FROM conversation_participants
        WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL`
      )
      .bind(conversationId, user.id)
      .first();

    if (!isParticipant) {
      throw new HTTPException(403, { message: 'Access denied' });
    }

    // Check if user already exists
    const existingParticipant = await db
      .prepare(
        `SELECT id, left_at FROM conversation_participants
        WHERE conversation_id = ? AND user_id = ?`
      )
      .bind(conversationId, validated.userId)
      .first();

    const timestamp = new Date().toISOString();

    if (existingParticipant) {
      // Rejoin if previously left
      await db
        .prepare(
          `UPDATE conversation_participants
          SET left_at = NULL, joined_at = ?
          WHERE id = ?`
        )
        .bind(timestamp, existingParticipant.id)
        .run();
    } else {
      // Create new participant
      const participantId = nanoid();
      await db
        .prepare(
          `INSERT INTO conversation_participants (id, conversation_id, user_id, joined_at)
          VALUES (?, ?, ?, ?)`
        )
        .bind(participantId, conversationId, validated.userId, timestamp)
        .run();
    }

    return c.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Validation error',
        cause: error.errors,
      });
    }
    if (error instanceof HTTPException) throw error;
    console.error('Error adding participant:', error);
    throw new HTTPException(500, { message: 'Failed to add participant' });
  }
});

/**
 * DELETE /api/conversations/:id/participants/:userId
 * Remove user from group (or leave group)
 */
app.delete('/:id/participants/:userId', async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id');
    const userIdToRemove = c.req.param('userId');
    const db = c.env.DB;

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // Users can remove themselves, or admins can remove others
    const canRemove = userIdToRemove === user.id || user.role === 'admin' || user.role === 'manager';

    if (!canRemove) {
      throw new HTTPException(403, { message: 'Access denied' });
    }

    // Soft delete: set left_at timestamp
    const timestamp = new Date().toISOString();

    await db
      .prepare(
        `UPDATE conversation_participants
        SET left_at = ?
        WHERE conversation_id = ? AND user_id = ?`
      )
      .bind(timestamp, conversationId, userIdToRemove)
      .run();

    return c.json({ success: true });
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    console.error('Error removing participant:', error);
    throw new HTTPException(500, { message: 'Failed to remove participant' });
  }
});

export default app;
