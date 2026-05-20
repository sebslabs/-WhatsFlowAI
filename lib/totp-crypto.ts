import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const SALT = 'whatsflow-totp-v1'

function deriveKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY
  if (!raw || raw.length < 32) {
    throw new Error('TOTP_ENCRYPTION_KEY must be set to a secret at least 32 characters long')
  }
  return scryptSync(raw, SALT, 32)
}

export function encryptTotpSecret(plain: string): { ciphertext: string; iv: string; tag: string } {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

export function decryptTotpSecret(parts: { ciphertext: string; iv: string; tag: string }): string {
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(parts.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(parts.tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(parts.ciphertext, 'base64')), decipher.final()]).toString(
    'utf8'
  )
}
