/**
 * Chat Sync Route - Batched Endpoint for Efficient Polling
 * Returns conversation updates, new messages, and presence in a single request
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import type { Env, Variables } from '../types/env';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
app.use('*', authenticate);

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const syncSchema = z.object({
  lastSync: z.string().optional(), // ISO timestamp
  activeConversationId: z.string().optional(),
  conversationTimestamps: z.record(z.string()).optional(), // { convId: timestamp }
  presenceUserIds: z.array(z.string()).max(50).optional(),
});

// ============================================================================
// BATCHED SYNC ENDPOINT
// ============================================================================

/**
 * POST /api/chat/sync
 * Batched endpoint for efficient polling
 * Returns: conversation updates, new messages, presence
 */
app.post('/sync', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validated = syncSchema.parse(body);
    const db = c.env.DB;

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    const response: any = {
      conversations: [],
      messages: {},
      presence: {},
      syncTimestamp: new Date().toISOString(),
    };

    // ==========================================================================
    // 1. Fetch conversation list updates (differential)
    // ==========================================================================
    let conversationsQuery = `
      SELECT
        c.id,
        c.type,
        c.name,
        strftime('%Y-%m-%dT%H:%M:%SZ', c.last_message_at) as lastMessageAt,
        strftime('%Y-%m-%dT%H:%M:%SZ', c.updated_at) as updatedAt,
        cp.unread_count as unreadCount,
        strftime('%Y-%m-%dT%H:%M:%SZ', cp.last_read_at) as lastReadAt,
        (
          SELECT json_group_array(
            json_object('userId', user_id)
          )
          FROM conversation_participants
          WHERE conversation_id = c.id AND left_at IS NULL
        ) as participants
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = ?
        AND cp.left_at IS NULL
        AND c.deleted_at IS NULL
    `;

    const conversationsBindings: any[] = [user.id];

    // Only fetch conversations updated since lastSync OR with unread messages
    if (validated.lastSync) {
      conversationsQuery += ` AND (c.updated_at > ? OR cp.unread_count > 0)`;
      conversationsBindings.push(validated.lastSync);
    }

    conversationsQuery += ` ORDER BY c.last_message_at DESC NULLS LAST LIMIT 50`;

    const conversationsResult = await db.prepare(conversationsQuery).bind(...conversationsBindings).all();

    response.conversations = (conversationsResult.results || []).map((conv: any) => ({
      ...conv,
      participants: conv.participants ? JSON.parse(conv.participants) : [],
    }));

    // ==========================================================================
    // 2. Fetch new messages for each conversation (differential)
    // ==========================================================================
    const timestamps = validated.conversationTimestamps || {};

    // Fetch messages for active conversation + any with unread
    const conversationsToFetch = new Set<string>();

    if (validated.activeConversationId) {
      conversationsToFetch.add(validated.activeConversationId);
    }

    // Add conversations with unread messages
    response.conversations.forEach((conv: any) => {
      if (conv.unreadCount > 0) {
        conversationsToFetch.add(conv.id);
      }
    });

    for (const convId of conversationsToFetch) {
      const lastFetch = timestamps[convId] || validated.lastSync;

      if (!lastFetch) continue; // Skip if no baseline timestamp

      const messagesResult = await db
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
          WHERE m.conversation_id = ?
            AND m.created_at > ?
            AND m.deleted_at IS NULL
          ORDER BY m.created_at ASC
          LIMIT 100`
        )
        .bind(convId, lastFetch)
        .all();

      if (messagesResult.results.length > 0) {
        response.messages[convId] = messagesResult.results;
      }
    }

    // ==========================================================================
    // 3. Fetch presence for requested users
    // ==========================================================================
    if (validated.presenceUserIds && validated.presenceUserIds.length > 0) {
      const placeholders = validated.presenceUserIds.map(() => '?').join(',');

      const presenceResult = await db
        .prepare(
          `SELECT
            id,
            strftime('%Y-%m-%dT%H:%M:%SZ', last_login) as lastSeen,
            CASE
              WHEN last_login IS NULL THEN 0
              WHEN julianday('now') - julianday(last_login) <= 0.003472 THEN 1
              ELSE 0
            END as isOnline
          FROM users
          WHERE id IN (${placeholders})
            AND deleted_at IS NULL`
        )
        .bind(...validated.presenceUserIds)
        .all();

      (presenceResult.results || []).forEach((row: any) => {
        response.presence[row.id] = {
          isOnline: row.isOnline === 1,
          lastSeen: row.lastSeen,
        };
      });
    }

    return c.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Validation error',
        cause: error.errors,
      });
    }
    if (error instanceof HTTPException) throw error;
    console.error('Error syncing chat:', error);
    throw new HTTPException(500, { message: 'Failed to sync chat' });
  }
});

export default app;
