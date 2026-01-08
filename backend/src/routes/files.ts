/**
 * File Serving Routes
 * Proxies R2 bucket files through Worker for public access
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /files/:key
 * Serve files from R2 bucket through Worker proxy
 * No authentication required - public file serving
 */
app.get('/:key{.+}', async (c) => {
  try {
    const key = c.req.param('key');

    // Fetch file from R2
    const object = await c.env.PHOTOS.get(key);

    if (!object) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Get content type from R2 metadata
    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';

    // Return file with proper headers for caching and CORS
    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
        'Access-Control-Allow-Origin': '*', // Allow cross-origin requests
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Error serving file from R2:', error);
    return c.json({ error: 'Failed to serve file' }, 500);
  }
});

export default app;
