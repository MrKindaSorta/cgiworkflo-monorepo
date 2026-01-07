/**
 * Authentication Middleware
 * Protects routes and enforces role-based access control
 */

import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verifyToken } from '../lib/jwt';
import type { Env, Variables } from '../types/env';

/**
 * Authentication middleware - verifies JWT token
 * Attaches user to context for use in route handlers
 */
export const authenticate = async (
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, {
      message: 'Unauthorized: No token provided',
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);

    // Attach user to context
    c.set('user', {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      franchiseId: payload.franchiseId,
    });

    await next();
  } catch (error) {
    throw new HTTPException(401, {
      message: 'Unauthorized: Invalid or expired token',
    });
  }
};

/**
 * Role-based authorization middleware
 * Checks if authenticated user has one of the required roles
 */
export const requireRole = (...roles: string[]) => {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
  ) => {
    const user = c.get('user');

    if (!user) {
      throw new HTTPException(401, {
        message: 'Unauthorized: Authentication required',
      });
    }

    if (!roles.includes(user.role)) {
      throw new HTTPException(403, {
        message: `Forbidden: Requires one of these roles: ${roles.join(', ')}`,
      });
    }

    await next();
  };
};

/**
 * Ownership check middleware
 * Ensures user can only access their own resources (unless admin/manager)
 */
export const requireOwnershipOrAdmin = (getUserIdFromResource: (c: Context) => string | Promise<string>) => {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
  ) => {
    const user = c.get('user');

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // Admins and managers can access any resource
    if (user.role === 'admin' || user.role === 'manager') {
      await next();
      return;
    }

    // Check ownership
    const resourceUserId = await getUserIdFromResource(c);

    if (resourceUserId !== user.id) {
      throw new HTTPException(403, {
        message: 'Forbidden: You can only access your own resources',
      });
    }

    await next();
  };
};
