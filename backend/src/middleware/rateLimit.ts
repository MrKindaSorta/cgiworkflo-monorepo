import { Context, Next } from 'hono';

interface RateLimitStore {
  [key: string]: { count: number; resetAt: number };
}

const store: RateLimitStore = {};

export const rateLimit = (options: {
  windowMs: number;
  maxRequests: number;
}) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    const userId = user?.id;

    if (!userId) {
      // If not authenticated, skip rate limiting (auth middleware will handle)
      return next();
    }

    const key = `${userId}:${c.req.path}`;
    const now = Date.now();

    // Initialize or reset if window expired
    if (!store[key] || store[key].resetAt < now) {
      store[key] = { count: 1, resetAt: now + options.windowMs };
    } else {
      store[key].count++;
    }

    // Check if limit exceeded
    if (store[key].count > options.maxRequests) {
      return c.json(
        {
          error: 'Too many requests. Please slow down.',
          retryAfter: Math.ceil((store[key].resetAt - now) / 1000)
        },
        429
      );
    }

    await next();
  };
};
