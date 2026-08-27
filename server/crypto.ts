import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Secret key for AES-256-GCM symmetric encryption
const FALLBACK_SECRET = 'nexus_ipam_enterprise_master_key_2026_secure_storage';
const SECRET_KEY = process.env.APP_SECRET_KEY || process.env.ENCRYPTION_KEY || FALLBACK_SECRET;

/**
 * Derives a 32-byte key from the secret
 */
function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(SECRET_KEY).digest();
}

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

/**
 * Encrypts sensitive string data using AES-256-GCM
 */
export function encryptSensitive(plainText: string): string {
  try {
    const iv = crypto.randomBytes(12);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[Crypto] Encryption error:', err);
    return plainText;
  }
}

/**
 * Decrypts AES-256-GCM encrypted string
 */
export function decryptSensitive(cipherPayload: string): string {
  try {
    const parts = cipherPayload.split(':');
    if (parts.length !== 3) return cipherPayload;
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[Crypto] Decryption error:', err);
    return cipherPayload;
  }
}

/**
 * Generates a cryptographically random API Key
 */
export function generateSecureApiKey(): { rawKey: string; keyHash: string; maskedKey: string; encryptedKey: string } {
  const token = crypto.randomBytes(24).toString('hex');
  const rawKey = `nx_live_${token}`;
  const keyHash = hashSensitiveData(rawKey);
  const maskedKey = `nx_live_${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  const encryptedKey = encryptSensitive(rawKey);

  return {
    rawKey,
    keyHash,
    maskedKey,
    encryptedKey,
  };
}
