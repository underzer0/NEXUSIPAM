import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Synchronous bcrypt password hashing
 */
export function hashPasswordSync(plainPassword: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainPassword, salt);
}

export const isBcryptHash = (hash: string) => /^\$2[aby]\$/.test(hash);

/**
 * Checks a password against a bcrypt hash. Anything that isn't a bcrypt hash never matches;
 * plain-text passwords from old databases are hashed when users are loaded.
 */
export function verifyPasswordSync(plainPassword: string, hash: string): boolean {
  if (!hash || !plainPassword || !isBcryptHash(hash)) return false;
  return bcrypt.compareSync(plainPassword, hash);
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
