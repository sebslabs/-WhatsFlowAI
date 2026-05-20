/**
 * Server-safe HTML sanitization.
 *
 * DOMPurify needs a DOM — we use the isomorphic build that works on the server.
 * Install: npm i isomorphic-dompurify
 *
 * Use sanitizeHtml() before storing or rendering any user-supplied content.
 * Use stripTags() when you need plain text only (chat message previews, logs).
 */

/**
 * Removes all HTML tags, leaving plain text only.
 * Safe for logging and non-rendered contexts.
 */
export function stripTags(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim()
}

/**
 * Sanitizes HTML to a safe subset for rendering rich content.
 * Only allows harmless formatting tags — strips scripts, event handlers, etc.
 *
 * Requires: npm i isomorphic-dompurify
 */
export async function sanitizeHtml(dirty: string): Promise<string> {
  try {
    const { default: DOMPurify } = await import('isomorphic-dompurify')
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      FORCE_BODY: false,
    })
  } catch {
    // If DOMPurify is unavailable, fall back to aggressive tag stripping
    return stripTags(dirty)
  }
}

/**
 * Truncates a string to a maximum length to prevent DB bloat and log injection.
 */
export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input
  return input.slice(0, maxLength)
}

/**
 * Sanitizes a WhatsApp message before storing in DB or passing to AI.
 * Strips HTML, truncates to safe length, removes null bytes.
 */
export function sanitizeMessage(raw: string): string {
  const stripped = stripTags(raw)
  const noNullBytes = stripped.replace(/\0/g, '')
  return truncate(noNullBytes, 4096)
}
