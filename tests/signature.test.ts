/**
 * MEDIUM FIX (#9): Signature tests now import the shared verifyWebhookHmac()
 * from lib/utils/webhook-hmac.ts — the exact same function used in production.
 *
 * Previously, this file re-implemented the HMAC logic independently, which meant
 * the test could pass while the production code diverged silently.
 */
import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { verifyWebhookHmac } from '@/lib/utils/webhook-hmac'

describe('Meta Webhook Signature Cryptographic Verification', () => {
  const secret = 'super-secret-key-123'
  const rawBody = JSON.stringify({ object: 'whatsapp', entry: [] })

  it('should accept valid signature header matched against exact payload and secret', () => {
    const expectedHash = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
    const signatureHeader = `sha256=${expectedHash}`

    const isValid = verifyWebhookHmac(rawBody, signatureHeader, secret)
    expect(isValid).toBe(true)
  })

  it('should reject invalid or tampered signature headers', () => {
    const signatureHeader = 'sha256=wronghash1234567890abcdefwronghash1234567890abcdefwronghash12'
    const isValid = verifyWebhookHmac(rawBody, signatureHeader, secret)
    expect(isValid).toBe(false)
  })

  it('should reject signature headers with missing sha256 prefix', () => {
    const expectedHash = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
    const signatureHeader = expectedHash // No sha256= prefix

    const isValid = verifyWebhookHmac(rawBody, signatureHeader, secret)
    expect(isValid).toBe(false)
  })

  it('should return false if secret is undefined', () => {
    const expectedHash = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
    const signatureHeader = `sha256=${expectedHash}`

    const isValid = verifyWebhookHmac(rawBody, signatureHeader, undefined)
    expect(isValid).toBe(false)
  })

  it('should reject different length inputs without crashing due to length check', () => {
    const shortSignature = 'sha256=abc'
    const isValid = verifyWebhookHmac(rawBody, shortSignature, secret)
    expect(isValid).toBe(false)
  })

  it('should return false when signatureHeader is null', () => {
    const isValid = verifyWebhookHmac(rawBody, null, secret)
    expect(isValid).toBe(false)
  })
})
