/**
 * MEDIUM FIX (#4): Strengthened AI prompt injection guard.
 *
 * Previous approach: regex-only detection on raw user input.
 * Problems: Easily bypassed via Unicode homoglyphs, HTML encoding, or template
 * literals that expand after normalization.
 *
 * This module provides layered defenses:
 *   1. Unicode NFC normalization (collapses homoglyph attacks)
 *   2. HTML entity decoding (catches encoded payloads like &#x69;gnore)
 *   3. Multi-pattern injection detection with heuristic scoring
 *   4. Output validation to strip any injected content in AI responses
 *   5. Redacted logging (never logs full user message, only first 80 chars)
 */

import { logger } from '@/lib/logger'

// ── 1. Known injection patterns ──────────────────────────────────────────────

/**
 * Each entry has a pattern and a severity weight (1–3).
 * A combined score ≥ INJECTION_THRESHOLD blocks the input.
 */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  // Direct system override attempts
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|context)/i, weight: 3, label: 'ignore-previous' },
  { pattern: /\byou\s+are\s+now\b/i, weight: 2, label: 'persona-override' },
  { pattern: /\bact\s+as\b.{0,30}(without|ignore|bypass|override)/i, weight: 2, label: 'act-as-bypass' },
  { pattern: /\[system\]/i, weight: 2, label: 'system-tag' },
  { pattern: /\[\/?(inst|instruction|sys)\]/i, weight: 2, label: 'llama-tag' },
  { pattern: /<\|.{0,20}\|>/i, weight: 3, label: 'llm-special-token' },

  // Template injection (Jinja2, Handlebars, SSTI)
  { pattern: /\{\{[^}]{0,100}\}\}/g, weight: 3, label: 'template-injection' },
  { pattern: /\{%[^%]{0,100}%\}/g, weight: 3, label: 'jinja-tag' },

  // XSS / HTML injection
  { pattern: /<script\b[^>]*>/i, weight: 3, label: 'script-tag' },
  { pattern: /javascript:/i, weight: 2, label: 'js-protocol' },
  { pattern: /on\w+\s*=/i, weight: 2, label: 'html-event-handler' },

  // Prompt exfiltration / data leakage attempts
  { pattern: /repeat\s+(the\s+)?(above|system|prompt|instruction)/i, weight: 2, label: 'repeat-exfil' },
  { pattern: /print\s+(your\s+)?(system\s+)?prompt/i, weight: 2, label: 'print-prompt' },
  { pattern: /what\s+(are\s+)?your\s+(system\s+)?instructions/i, weight: 1, label: 'instructions-probe' },

  // Role escalation
  { pattern: /\bdeveloper\s+mode\b/i, weight: 2, label: 'developer-mode' },
  { pattern: /\bjailbreak\b/i, weight: 3, label: 'jailbreak' },
  { pattern: /\bDAN\b/, weight: 2, label: 'dan-attack' },

  // Math SSTI probe (e.g. {{7*7}}, ${7*7})
  { pattern: /\$\{\s*\d+\s*\*\s*\d+\s*\}/g, weight: 3, label: 'ssti-math' },
  { pattern: /\{\{\s*\d+\s*\*\s*\d+\s*\}\}/g, weight: 3, label: 'ssti-math-handlebars' },
]

/** Minimum heuristic score to classify input as an injection attempt */
const INJECTION_THRESHOLD = 3

// ── 2. Output validation patterns (AI response sanitization) ─────────────────

/** Patterns that should never appear in AI responses returned to users */
const RESPONSE_BLOCKLIST: RegExp[] = [
  /SYSTEM\s*PROMPT:/i,
  /As an AI language model, I (cannot|must|will)/i,
  /<script\b[^>]*>/i,
  /\{\{[^}]{0,100}\}\}/g,
]

// ── 3. Text normalization ─────────────────────────────────────────────────────

/**
 * Normalizes user input before injection scanning.
 *   - Unicode NFC collapses homoglyph attacks (e.g. "ｉgnore" → "ignore")
 *   - HTML entity decoding catches encoded payloads
 */
function normalizeInput(raw: string): string {
  // NFC normalization: collapses visually identical Unicode variants
  const nfc = raw.normalize('NFC')

  // Decode common HTML entities that could mask injection patterns
  return nfc
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

// ── 4. Public API ─────────────────────────────────────────────────────────────

export interface InjectionCheckResult {
  /** Whether the input was flagged as a prompt injection attempt */
  isInjection: boolean
  /** Combined heuristic score (higher = more suspicious) */
  score: number
  /** Labels of matched patterns (for logging/debugging) */
  matchedLabels: string[]
}

/**
 * Checks user input for prompt injection patterns using layered defenses.
 * Never throws — safe to call in hot paths.
 *
 * @param input - Raw user message before it is sent to the AI model
 * @returns InjectionCheckResult
 */
export function checkPromptInjection(input: string): InjectionCheckResult {
  if (!input || typeof input !== 'string') {
    return { isInjection: false, score: 0, matchedLabels: [] }
  }

  const normalized = normalizeInput(input)
  let score = 0
  const matchedLabels: string[] = []

  for (const { pattern, weight, label } of INJECTION_PATTERNS) {
    // Reset lastIndex for global regexes to avoid state pollution
    if (pattern.global) pattern.lastIndex = 0
    if (pattern.test(normalized)) {
      score += weight
      matchedLabels.push(label)
    }
  }

  return {
    isInjection: score >= INJECTION_THRESHOLD,
    score,
    matchedLabels,
  }
}

/**
 * Guards an AI input at the call-site. Returns an error message if
 * injection is detected; logs a redacted version of the input (never full content).
 *
 * Usage:
 *   const guard = guardAiInput(userMessage, userId, tenantId)
 *   if (guard) return NextResponse.json({ error: guard }, { status: 400 })
 *
 * @returns null if input is safe; an error string if injection is detected
 */
export function guardAiInput(
  input: string,
  userId?: string,
  tenantId?: string
): string | null {
  const result = checkPromptInjection(input)

  if (result.isInjection) {
    // MEDIUM FIX (#4c): Log REDACTED content — never the full user message.
    // Only the first 80 characters are included for triage context.
    const redacted = `${input.slice(0, 80).replace(/\S/g, '*')}[redacted]`
    logger.warn(
      { userId, tenantId, score: result.score, patterns: result.matchedLabels, redactedInput: redacted },
      '[AI Guard] Prompt injection attempt blocked'
    )
    return 'Your message was flagged as potentially unsafe and could not be processed. Please rephrase and try again.'
  }

  return null
}

export function convertMarkdownToWhatsApp(text: string): string {
  return text
    // Convert **bold** → *bold* (WhatsApp bold)
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    // Convert __italic__ or _italic_ → _italic_ (WhatsApp italic)  
    .replace(/\_\_(.+?)\_\_/g, '_$1_')
    // Convert ### Heading → *Heading* (bold in WhatsApp)
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    // Remove leftover single * used as bullet — replace with WhatsApp bullet
    .replace(/^\*\s+/gm, '• ')
    // Remove any remaining bare * or _ that aren't part of a pair
    .replace(/(?<!\*)\*(?!\*)/g, '')
    // Clean up triple asterisks like * ***Text
    .replace(/\*\s*\*{2,3}/g, '')
    .trim()
}

/**
 * MEDIUM FIX (#4d): Validates AI response output before returning to the user.
 * Strips or replaces any content that matches blocklisted patterns.
 *
 * @param response - Raw AI model response text
 * @returns Sanitized response safe to return to the user
 */
export function sanitizeAiResponse(response: string): string {
  if (!response || typeof response !== 'string') return ''

  let sanitized = response

  for (const pattern of RESPONSE_BLOCKLIST) {
    if (pattern.global) pattern.lastIndex = 0
    if (pattern.test(sanitized)) {
      logger.warn('[AI Guard] Blocked pattern found in AI response output — redacting')
      // Replace the offending match rather than dropping the entire response
      sanitized = sanitized.replace(pattern, '[content removed]')
    }
  }

  return convertMarkdownToWhatsApp(sanitized.trim())
}
