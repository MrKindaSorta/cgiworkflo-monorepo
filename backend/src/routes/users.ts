/**
 * User Management Routes
 * Handles CRUD operations for users
 * Only admins can create/update/delete users
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { hashPassword } from '../lib/hash';
import type { Env, Variables } from '../types/env';

const users = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'manager', 'franchisee', 'employee']),
  franchiseId: z.string().nullable().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['admin', 'manager', 'franchisee', 'employee']).optional(),
  franchiseId: z.string().nullable().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/users
 * List all users (admin/manager only)
 */
users.get('/', authenticate, requireRole('admin', 'manager'), async (c) => {
  try {
    const db = c.env.DB;

    // Get all non-deleted users with last_login and preferences
    const result = await db
      .prepare(
        `SELECT
          id, name, email, role, franchise_id as franchiseId,
          address, phone, last_login as lastLogin,
          preferences_language as language, preferences_theme as theme,
          preferences_unit_area as unitArea, preferences_unit_liquid as unitLiquid,
          created_at as createdAt, updated_at as updatedAt
        FROM users
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC`
      )
      .all();

    return c.json({
      success: true,
      data: result.results || [],
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    throw new HTTPException(500, { message: 'Failed to fetch users' });
  }
});

/**
 * GET /api/users/:id
 * Get a specific user by ID (admin/manager only)
 */
users.get('/:id', authenticate, requireRole('admin', 'manager'), async (c) => {
  try {
    const userId = c.req.param('id');
    const db = c.env.DB;

    const result = await db
      .prepare(
        `SELECT
          id, name, email, role, franchise_id as franchiseId,
          address, phone, last_login as lastLogin,
          preferences_language as language, preferences_theme as theme,
          preferences_unit_area as unitArea, preferences_unit_liquid as unitLiquid,
          created_at as createdAt, updated_at as updatedAt
        FROM users
        WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(userId)
      .first();

    if (!result) {
      throw new HTTPException(404, { message: 'User not found' });
    }

    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    console.error('Error fetching user:', error);
    throw new HTTPException(500, { message: 'Failed to fetch user' });
  }
});

/**
 * POST /api/users
 * Create a new user (admin only)
 */
users.post('/', authenticate, requireRole('admin'), async (c) => {
  try {
    const body = await c.req.json();

    // Validate request body
    const validatedData = createUserSchema.parse(body);

    const db = c.env.DB;

    // Check if email already exists
    const existingUser = await db
      .prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL')
      .bind(validatedData.email)
      .first();

    if (existingUser) {
      throw new HTTPException(409, { message: 'Email already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(validatedData.password);

    // Generate ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Insert user
    await db
      .prepare(
        `INSERT INTO users (
          id, name, email, password_hash, role, franchise_id, address, phone,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .bind(
        userId,
        validatedData.name,
        validatedData.email,
        passwordHash,
        validatedData.role,
        validatedData.franchiseId || null,
        validatedData.address || null,
        validatedData.phone || null
      )
      .run();

    // Fetch created user
    const newUser = await db
      .prepare(
        `SELECT
          id, name, email, role, franchise_id as franchiseId,
          address, phone, created_at as createdAt, updated_at as updatedAt
        FROM users
        WHERE id = ?`
      )
      .bind(userId)
      .first();

    return c.json(
      {
        success: true,
        message: 'User created successfully',
        data: newUser,
      },
      201
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Validation error',
        cause: error.errors
      });
    }
    if (error instanceof HTTPException) throw error;
    console.error('Error creating user:', error);
    throw new HTTPException(500, { message: 'Failed to create user' });
  }
});

/**
 * PUT /api/users/:id
 * Update an existing user (admin only)
 */
users.put('/:id', authenticate, requireRole('admin'), async (c) => {
  try {
    const userId = c.req.param('id');
    const body = await c.req.json();

    // Validate request body
    const validatedData = updateUserSchema.parse(body);

    const db = c.env.DB;

    // Check if user exists
    const existingUser = await db
      .prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL')
      .bind(userId)
      .first();

    if (!existingUser) {
      throw new HTTPException(404, { message: 'User not found' });
    }

    // Check email uniqueness if email is being updated
    if (validatedData.email) {
      const emailCheck = await db
        .prepare('SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at IS NULL')
        .bind(validatedData.email, userId)
        .first();

      if (emailCheck) {
        throw new HTTPException(409, { message: 'Email already exists' });
      }
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (validatedData.name) {
      updates.push('name = ?');
      values.push(validatedData.name);
    }
    if (validatedData.email) {
      updates.push('email = ?');
      values.push(validatedData.email);
    }
    if (validatedData.password) {
      const passwordHash = await hashPassword(validatedData.password);
      updates.push('password_hash = ?');
      values.push(passwordHash);
    }
    if (validatedData.role) {
      updates.push('role = ?');
      values.push(validatedData.role);
    }
    if (validatedData.franchiseId !== undefined) {
      updates.push('franchise_id = ?');
      values.push(validatedData.franchiseId);
    }
    if (validatedData.address !== undefined) {
      updates.push('address = ?');
      values.push(validatedData.address);
    }
    if (validatedData.phone !== undefined) {
      updates.push('phone = ?');
      values.push(validatedData.phone);
    }

    if (updates.length === 0) {
      throw new HTTPException(400, { message: 'No fields to update' });
    }

    // Always update updated_at
    updates.push("updated_at = datetime('now')");
    values.push(userId); // For WHERE clause

    await db
      .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    // Fetch updated user
    const updatedUser = await db
      .prepare(
        `SELECT
          id, name, email, role, franchise_id as franchiseId,
          address, phone, created_at as createdAt, updated_at as updatedAt
        FROM users
        WHERE id = ?`
      )
      .bind(userId)
      .first();

    return c.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Validation error',
        cause: error.errors
      });
    }
    if (error instanceof HTTPException) throw error;
    console.error('Error updating user:', error);
    throw new HTTPException(500, { message: 'Failed to update user' });
  }
});

/**
 * DELETE /api/users/:id
 * Soft delete a user (admin only)
 */
users.delete('/:id', authenticate, requireRole('admin'), async (c) => {
  try {
    const userId = c.req.param('id');
    const currentUser = c.get('user');
    const db = c.env.DB;

    if (!currentUser) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // Prevent self-deletion
    if (userId === currentUser.id) {
      throw new HTTPException(400, { message: 'Cannot delete your own account' });
    }

    // Check if user exists
    const existingUser = await db
      .prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL')
      .bind(userId)
      .first();

    if (!existingUser) {
      throw new HTTPException(404, { message: 'User not found' });
    }

    // Soft delete user
    await db
      .prepare("UPDATE users SET deleted_at = datetime('now') WHERE id = ?")
      .bind(userId)
      .run();

    return c.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    console.error('Error deleting user:', error);
    throw new HTTPException(500, { message: 'Failed to delete user' });
  }
});

/**
 * PATCH /api/users/preferences
 * Update current user's preferences (any authenticated user)
 */
users.patch('/preferences', authenticate, async (c) => {
  try {
    const currentUser = c.get('user');

    if (!currentUser) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    const body = await c.req.json();
    const db = c.env.DB;

    // Validate preferences
    const validPreferences: Record<string, string> = {};

    if (body.language && ['en', 'fr', 'de', 'es', 'ja'].includes(body.language)) {
      validPreferences.preferences_language = body.language;
    }

    if (body.theme && ['light', 'dark'].includes(body.theme)) {
      validPreferences.preferences_theme = body.theme;
    }

    if (body.unitArea && ['sqft', 'sqm'].includes(body.unitArea)) {
      validPreferences.preferences_unit_area = body.unitArea;
    }

    if (body.unitLiquid && ['ml', 'oz', 'l', 'gal'].includes(body.unitLiquid)) {
      validPreferences.preferences_unit_liquid = body.unitLiquid;
    }

    if (Object.keys(validPreferences).length === 0) {
      throw new HTTPException(400, { message: 'No valid preferences to update' });
    }

    // Build update query
    const updates = Object.keys(validPreferences).map(key => `${key} = ?`);
    const values = Object.values(validPreferences);
    values.push(currentUser.id); // For WHERE clause

    await db
      .prepare(
        `UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(...values)
      .run();

    // Fetch updated preferences
    const updatedUser = await db
      .prepare(
        `SELECT
          preferences_language as language, preferences_theme as theme,
          preferences_unit_area as unitArea, preferences_unit_liquid as unitLiquid
        FROM users WHERE id = ?`
      )
      .bind(currentUser.id)
      .first();

    return c.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        language: updatedUser?.language || 'en',
        theme: updatedUser?.theme || 'light',
        unitArea: updatedUser?.unitArea || 'sqft',
        unitLiquid: updatedUser?.unitLiquid || 'ml',
      },
    });
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    console.error('Error updating preferences:', error);
    throw new HTTPException(500, { message: 'Failed to update preferences' });
  }
});

export default users;
