/**
 * JWT Token Utilities
 * Uses jose library for JWT generation and verification
 */

import { SignJWT, jwtVerify } from 'jose';

export interface JWTPayload {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'franchisee' | 'employee';
  franchiseId?: string;
}

/**
 * Generate a JWT token
 * @param payload - User data to include in token
 * @param secret - JWT secret key
 * @returns JWT token string
 */
export async function generateToken(
  payload: JWTPayload,
  secret: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7 days
    .sign(secretKey);

  return token;
}

/**
 * Verify and decode a JWT token
 * @param token - JWT token string
 * @param secret - JWT secret key
 * @returns Decoded payload
 * @throws Error if token is invalid or expired
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<JWTPayload> {
  const secretKey = new TextEncoder().encode(secret);

  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
