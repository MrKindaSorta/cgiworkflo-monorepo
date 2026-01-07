/**
 * Environment Bindings Type Definition
 * Defines all Cloudflare Workers bindings and environment variables
 */

export interface Env {
  // Environment
  ENVIRONMENT: string; // 'development' | 'staging' | 'production'
  API_VERSION: string;

  // CORS
  CORS_ORIGINS: string; // Comma-separated origins

  // Upload Configuration
  MAX_UPLOAD_SIZE_MB: string;

  // Rate Limiting
  RATE_LIMIT_REQUESTS: string;
  RATE_LIMIT_WINDOW_SECONDS: string;

  // JWT Configuration (secret)
  JWT_SECRET: string;

  // Cloudflare Bindings
  DB: D1Database;        // D1 database binding
  PHOTOS: R2Bucket;      // R2 bucket for photos/attachments
  CACHE: KVNamespace;    // KV namespace for caching and rate limiting
}

/**
 * Context Variables
 * Set by middleware and available in route handlers
 */
export interface Variables {
  user?: {
    id: string;
    email: string;
    role: 'admin' | 'manager' | 'franchisee' | 'employee';
    franchiseId?: string;
  };
}
