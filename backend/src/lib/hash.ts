/**
 * Password Hashing Utilities
 * Uses bcryptjs for secure password hashing
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash a password
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  return hash;
}

/**
 * Compare a password with its hash
 * @param password - Plain text password
 * @param hash - Hashed password from database
 * @returns True if password matches, false otherwise
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  const isMatch = await bcrypt.compare(password, hash);
  return isMatch;
}
