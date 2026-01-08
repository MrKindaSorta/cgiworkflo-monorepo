/**
 * File Upload Routes
 * Handles uploading images and files to R2 for chat messages
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import type { Env, Variables } from '../types/env';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
app.use('*', authenticate);

// Allowed MIME types for uploads
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/plain',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/uploads
 * Upload a file to R2
 * Rate limited to 20 uploads per minute
 */
app.post('/', rateLimit({ windowMs: 60000, maxRequests: 20 }), async (c) => {
  try {
    const user = c.get('user');

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // Parse form data
    const formData = await c.req.formData();
    const fileEntry = formData.get('file');

    if (!fileEntry || typeof fileEntry === 'string') {
      throw new HTTPException(400, { message: 'No file provided' });
    }

    const file = fileEntry as File;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new HTTPException(400, { message: `File too large (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)` });
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      throw new HTTPException(400, { message: 'Invalid file type. Supported: images, PDF, Word, Excel, text files' });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 11);
    const extension = file.name.split('.').pop() || 'bin';
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `chat-uploads/${user.id}/${timestamp}-${randomStr}.${extension}`;

    try {
      // Upload to R2
      const arrayBuffer = await file.arrayBuffer();
      await c.env.PHOTOS.put(key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
        },
        customMetadata: {
          originalFilename: safeFilename,
          uploadedBy: user.id,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Serve files through Worker proxy (avoids needing public bucket access)
      const url = `https://cgiworkflo-api.joshua-r-klimek.workers.dev/files/${key}`;

      return c.json({
        success: true,
        data: {
          url,
          filename: file.name,
          size: file.size,
          type: file.type,
          key, // Store this in message metadata for later deletion if needed
        },
      });
    } catch (error) {
      console.error('R2 upload error:', error);
      throw new HTTPException(500, { message: 'Failed to upload file to storage' });
    }
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    console.error('Error uploading file:', error);
    throw new HTTPException(500, { message: 'Failed to process upload' });
  }
});

export default app;
