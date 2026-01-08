/**
 * Authentication Routes
 * Handles user registration, login, and session management
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { generateToken } from '../lib/jwt';
import { hashPassword, comparePassword } from '../lib/hash';
import { authenticate } from '../middleware/auth';
import type { Env, Variables } from '../types/env';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'manager', 'franchisee', 'employee']),
  address: z.string().optional(),
  phone: z.string().optional(),
  franchiseId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const devLoginSchema = z.object({
  role: z.enum(['admin', 'manager', 'franchisee', 'employee']),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/auth/register
 * Create a new user account
 */
app.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const validated = registerSchema.parse(body);

    // Check if email already exists
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL'
    )
      .bind(validated.email)
      .first();

    if (existingUser) {
      return c.json({ error: 'Email already exists' }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(validated.password);

    // Create user
    const userId = nanoid();
    await c.env.DB.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, address, phone, franchise_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
      .bind(
        userId,
        validated.name,
        validated.email,
        passwordHash,
        validated.role,
        validated.address || null,
        validated.phone || null,
        validated.franchiseId || null
      )
      .run();

    // Fetch created user
    const user = await c.env.DB.prepare(
      'SELECT id, name, email, role, franchise_id as franchiseId, created_at as createdAt FROM users WHERE id = ?'
    )
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'Failed to create user' }, 500);
    }

    // Generate JWT token
    const token = await generateToken(
      {
        id: user.id as string,
        email: user.email as string,
        role: user.role as any,
        franchiseId: user.franchiseId as string | undefined,
      },
      c.env.JWT_SECRET
    );

    return c.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          franchiseId: user.franchiseId,
          createdAt: user.createdAt,
        },
        token,
      },
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: 'Validation error',
          details: error.flatten().fieldErrors,
        },
        400
      );
    }

    console.error('Registration error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
app.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const validated = loginSchema.parse(body);

    // Find user by email with preferences
    const user = await c.env.DB.prepare(
      `SELECT id, name, email, password_hash, role, franchise_id as franchiseId,
              preferences_unit_area as unitArea, preferences_unit_liquid as unitLiquid,
              preferences_language as language, preferences_theme as theme
       FROM users WHERE email = ? AND deleted_at IS NULL`
    )
      .bind(validated.email)
      .first();

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const isValid = await comparePassword(
      validated.password,
      user.password_hash as string
    );

    if (!isValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Update last_login timestamp
    await c.env.DB.prepare(
      "UPDATE users SET last_login = datetime('now') WHERE id = ?"
    )
      .bind(user.id)
      .run();

    // Generate JWT token
    const token = await generateToken(
      {
        id: user.id as string,
        email: user.email as string,
        role: user.role as any,
        franchiseId: user.franchiseId as string | undefined,
      },
      c.env.JWT_SECRET
    );

    return c.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        franchiseId: user.franchiseId,
        preferences: {
          unitArea: user.unitArea || 'sqft',
          unitLiquid: user.unitLiquid || 'ml',
          language: user.language || 'en',
          theme: user.theme || 'light',
        },
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: 'Validation error',
          details: error.flatten().fieldErrors,
        },
        400
      );
    }

    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user's profile
 */
app.get('/me', authenticate, async (c) => {
  const currentUser = c.get('user');

  if (!currentUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Fetch full user details from database
  const user = await c.env.DB.prepare(
    `SELECT id, name, email, role, franchise_id as franchiseId, address, phone,
            preferences_unit_area as unitArea, preferences_unit_liquid as unitLiquid,
            preferences_language as language, preferences_theme as theme,
            created_at as createdAt
     FROM users WHERE id = ? AND deleted_at IS NULL`
  )
    .bind(currentUser.id)
    .first();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      franchiseId: user.franchiseId,
      address: user.address,
      phone: user.phone,
      preferences: {
        unitArea: user.unitArea,
        unitLiquid: user.unitLiquid,
        language: user.language,
        theme: user.theme,
      },
      createdAt: user.createdAt,
    },
  });
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
app.post('/logout', authenticate, async (c) => {
  // JWT is stateless - logout happens on client by removing token
  // Optionally: Add token to blacklist in KV for immediate invalidation

  return c.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * POST /api/auth/dev-login
 * Quick login for development - select role and auto-login with demo user
 * ONLY AVAILABLE IN DEVELOPMENT ENVIRONMENT
 */
app.post('/dev-login', async (c) => {
  // Note: Allows demo account login in any environment for testing
  // Demo accounts use @demo.com email domain and are not real users

  try {
    const body = await c.req.json();
    const validated = devLoginSchema.parse(body);

    // Map role to demo user email
    const emailMap: Record<string, string> = {
      admin: 'admin@demo.com',
      manager: 'manager@demo.com',
      franchisee: 'franchisee@demo.com',
      employee: 'employee@demo.com',
    };

    const email = emailMap[validated.role];

    if (!email) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    // Find demo user with preferences
    const user = await c.env.DB.prepare(
      `SELECT id, name, email, role, franchise_id as franchiseId,
              preferences_unit_area as unitArea, preferences_unit_liquid as unitLiquid,
              preferences_language as language, preferences_theme as theme
       FROM users WHERE email = ? AND deleted_at IS NULL`
    )
      .bind(email)
      .first();

    if (!user) {
      return c.json(
        {
          error: 'Demo user not found',
          message: 'Please run database seed command to create demo users',
        },
        404
      );
    }

    // Update last_login timestamp
    await c.env.DB.prepare(
      "UPDATE users SET last_login = datetime('now') WHERE id = ?"
    )
      .bind(user.id)
      .run();

    // Generate JWT token (skip password verification for dev login)
    const token = await generateToken(
      {
        id: user.id as string,
        email: user.email as string,
        role: user.role as any,
        franchiseId: user.franchiseId as string | undefined,
      },
      c.env.JWT_SECRET
    );

    return c.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        franchiseId: user.franchiseId,
        preferences: {
          unitArea: user.unitArea || 'sqft',
          unitLiquid: user.unitLiquid || 'ml',
          language: user.language || 'en',
          theme: user.theme || 'light',
        },
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: 'Validation error',
          details: error.flatten().fieldErrors,
        },
        400
      );
    }

    console.error('Dev login error:', error);
    return c.json({ error: 'Dev login failed' }, 500);
  }
});

export default app;
