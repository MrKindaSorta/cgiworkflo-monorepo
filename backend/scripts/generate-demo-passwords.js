/**
 * Generate bcrypt password hashes for demo users
 * Run with: node scripts/generate-demo-passwords.js
 */

import bcrypt from 'bcryptjs';

const password = 'demo123';
const rounds = 10;

async function generateHashes() {
  console.log('Generating bcrypt hashes for password: demo123\n');

  const hash = await bcrypt.hash(password, rounds);

  console.log('Password hash (use for all 4 demo users):');
  console.log(hash);
  console.log('\nCopy this hash to backend/src/db/seed.sql');
}

generateHashes().catch(console.error);
