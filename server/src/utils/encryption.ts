/**
 * Encryption Helpers — pgcrypto-compatible AES-256-GCM
 *
 * Used to encrypt sensitive data (WhatsApp tokens, webhook secrets, API keys)
 * BEFORE inserting into PostgreSQL.
 *
 * Strategy:
 *  - AES-256-GCM via Node.js crypto (no extra deps)
 *  - Random 12-byte IV per encryption
 *  - Authentication tag prevents tampering
 *  - Output: base64("iv:authTag:ciphertext") — all three parts needed to decrypt
 *
 * Key Management:
 *  - ENCRYPTION_KEY must be 32 bytes hex (64 hex chars) in env
 *  - Rotate by decrypting old data with old key, re-encrypting with new key
 *  - NEVER store the key in the database
 *
 * Usage:
 *   const encrypted = encrypt(access_token)
 *   await db.from('whatsapp_accounts').update({ access_token: encrypted })
 *
 *   const plaintext = decrypt(row.access_token)
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12  // GCM standard
const TAG_LENGTH = 16 // GCM auth tag

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      '[encryption] ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
      'Generate with: openssl rand -hex 32'
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded payload containing iv:authTag:ciphertext.
 * Returns null if value is null/undefined (preserves DB nullability).
 */
export function encrypt(value: string | null | undefined): string | null {
  if (value == null) return null

  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })

  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Pack all three parts into a single base64 string
  const packed = Buffer.concat([iv, authTag, encrypted])
  return packed.toString('base64')
}

/**
 * Decrypt an encrypted payload produced by encrypt().
 * Returns null if value is null/undefined (preserves DB nullability).
 * Throws on tampered/corrupt data (GCM auth tag mismatch).
 */
export function decrypt(value: string | null | undefined): string | null {
  if (value == null) return null

  const key = getKey()
  const packed = Buffer.from(value, 'base64')

  const iv      = packed.subarray(0, IV_LENGTH)
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(authTag)

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    throw new Error('[encryption] Decryption failed — data may be tampered or key is wrong')
  }
}

/**
 * Hash a value with SHA-256 for non-reversible lookup (e.g., api_keys.key_hash).
 * Returns hex string.
 */
export function hashForLookup(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

/**
 * Generate a secure random API key with prefix.
 * Returns: { plaintext: 'wf_...', hash: '...', prefix: 'wf_xxxx' }
 * Store ONLY hash and prefix. NEVER store the plaintext.
 */
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const raw = crypto.randomBytes(32).toString('base64url')
  const plaintext = `wf_${raw}`
  const hash = hashForLookup(plaintext)
  const prefix = plaintext.slice(0, 10)
  return { plaintext, hash, prefix }
}

/**
 * Safely compare two strings in constant time (prevent timing attacks).
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
