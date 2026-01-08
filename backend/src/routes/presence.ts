/**
 * Presence & Online Status Routes
 * Tracks user heartbeats and online status
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
// VALIDATION SCHEMAS
// ============================================================================

const getPresenceSchema = z.object({
  userIds: z.array(z.string()).max(50), // Limit to 50 users per request
});

// ============================================================================
// PRESENCE ROUTES
// ============================================================================

/**
 * POST /api/presence/heartbeat
 * Update user's last_login timestamp (heartbeat)
 * Called every 2 minutes by frontend to indicate user is active
 */
app.post('/heartbeat', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // Update last_login to current time
    await db
      .prepare(`UPDATE users SET last_login = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`)
      .bind(user.id)
      .run();

    return c.json({ success: true });
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    console.error('Error updating heartbeat:', error);
    throw new HTTPException(500, { message: 'Failed to update heartbeat' });
  }
});

/**
 * POST /api/presence/status
 * Get online status for multiple users (batched query)
 * Users are "online" if last_login is within 5 minutes
 */
app.post('/status', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validated = getPresenceSchema.parse(body);
    const db = c.env.DB;

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    if (validated.userIds.length === 0) {
      return c.json({ success: true, data: {} });
    }

    // Query: Users are "online" if last_login within 5 minutes
    // 0.003472 Julian days = 5 minutes (5 / 1440)
    const placeholders = validated.userIds.map(() => '?').join(',');

    const results = await db
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
      .bind(...validated.userIds)
      .all();

    // Convert to map
    const presenceMap: Record<string, { isOnline: boolean; lastSeen: string | null }> = {};

    (results.results || []).forEach((row: any) => {
      presenceMap[row.id] = {
        isOnline: row.isOnline === 1,
        lastSeen: row.lastSeen,
      };
    });

    return c.json({
      success: true,
      data: presenceMap,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Validation error',
        cause: error.errors,
      });
    }
    if (error instanceof HTTPException) throw error;
    console.error('Error fetching presence:', error);
    throw new HTTPException(500, { message: 'Failed to fetch presence' });
  }
});

export default app;
