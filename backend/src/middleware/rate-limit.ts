/**
 * Rate Limiting Middleware
 * Prevents API abuse by limiting requests per user
 */

import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env, Variables } from '../types/env';

// In-memory rate limit store
// Note: In production with multiple Workers, consider using KV Namespace
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limit middleware factory
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 */
export const rateLimit = (maxRequests: number, windowMs: number) => {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const user = c.get('user');

    // Skip rate limiting if no user (shouldn't happen with authenticate middleware)
    if (!user) {
      await next();
      return;
    }

    const now = Date.now();
    const userId = user.id;
    const userLimit = rateLimitMap.get(userId);

    // First request or window expired
    if (!userLimit || now > userLimit.resetAt) {
      rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    // Check if limit exceeded
    if (userLimit.count >= maxRequests) {
      const retryAfter = Math.ceil((userLimit.resetAt - now) / 1000);
      c.header('Retry-After', retryAfter.toString());
      throw new HTTPException(429, {
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      });
    }

    // Increment count
    userLimit.count++;
    await next();
  };
};

/**
 * Cleanup old entries periodically to prevent memory leaks
 * Call this from a cron job or scheduled task
 */
export const cleanupRateLimitMap = () => {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  rateLimitMap.forEach((value, key) => {
    if (now > value.resetAt + 60000) {
      // Delete entries 1 minute after reset
      entriesToDelete.push(key);
    }
  });

  entriesToDelete.forEach((key) => rateLimitMap.delete(key));

  if (entriesToDelete.length > 0) {
    console.log(`[RateLimit] Cleaned up ${entriesToDelete.length} expired entries`);
  }
};
