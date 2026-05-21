/**
 * Shared HMAC-SHA256 verification for Meta WhatsApp webhook payloads.
 *
 * MEDIUM FIX (#9): Previously the same HMAC logic was duplicated between
 * app/api/webhooks/whatsapp/route.ts and tests/signature.test.ts, risking
 * silent divergence (test passes while production uses different code).
 *
 * Both the production route and all tests must import from this file.
 */
import crypto from 'crypto'

/**
 * Verifies a Meta `x-hub-signature-256` header against the raw request body.
 *
 * @param rawBody - The raw UTF-8 request body string (must not be JSON.parsed first)
 * @param signatureHeader - The full header value, e.g. `"sha256=abc123..."`
 * @param secret - The META_APP_SECRET used to create the expected HMAC digest
 * @returns true if the signature is cryptographically valid
 */
export function verifyWebhookHmac(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string | undefined
): boolean {
  // Reject immediately if prerequisite data is missing
  if (!signatureHeader?.startsWith('sha256=')) return false
  if (!secret) return false

  const received = signatureHeader.slice(7) // strip "sha256=" prefix
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')

  try {
    const a = Buffer.from(received, 'hex')
    const b = Buffer.from(expected, 'hex')

    // Guard: timingSafeEqual requires equal-length buffers
    if (a.length !== b.length) return false

    // Constant-time comparison prevents timing side-channel attacks
    return crypto.timingSafeEqual(a, b)
  } catch {
    // Catches invalid hex, zero-length buffers, etc.
    return false
  }
}
