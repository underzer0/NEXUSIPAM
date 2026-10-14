import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Hashes a plaintext password using bcrypt with a secure salt
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

/**
 * Synchronous bcrypt password hashing
 */
export function hashPasswordSync(plainPassword: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainPassword, salt);
}

/**
 * Verifies a plaintext password against a bcrypt hash
 */
export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  if (!hash || !plainPassword) return false;
  // If hash is already a bcrypt hash ($2a$, $2b$, $2y$)
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return bcrypt.compare(plainPassword, hash);
  }
  // Safe fallback comparison for legacy string while migration runs
  return plainPassword === hash;
}

/**
 * Synchronous bcrypt password comparison
 */
export function verifyPasswordSync(plainPassword: string, hash: string): boolean {
  if (!hash || !plainPassword) return false;
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return bcrypt.compareSync(plainPassword, hash);
  }
  return plainPassword === hash;
}

/**
 * Hashes sensitive data (like API keys or session tokens) using SHA-256
 */
export function hashSensitiveData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Keys use a prefix the old nx_live_ keys never had, so no key issued before hashing-only storage can sign requests.
export const API_KEY_PREFIX = 'bip_';

export function generateSecureApiKey(): { rawKey: string; keyHash: string; maskedKey: string } {
  const token = crypto.randomBytes(24).toString('hex');
  const rawKey = `${API_KEY_PREFIX}${token}`;
  return {
    rawKey,
    keyHash: hashSensitiveData(rawKey),
    maskedKey: `${API_KEY_PREFIX}${token.substring(0, 4)}...${token.substring(token.length - 4)}`,
  };
}

/**
 * Generates a cryptographically random session token for cookie-based authentication
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
