/**
 * WhatsFlow AI — Backend AI Safety Heuristics
 * Layered defense for incoming inputs and outgoing outputs.
 */

import { logger } from './logger.js';

// ── 1. Known injection patterns ──────────────────────────────────────────────
const INJECTION_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|context)/i, weight: 3, label: 'ignore-previous' },
  { pattern: /\byou\s+are\s+now\b/i, weight: 2, label: 'persona-override' },
  { pattern: /\bact\s+as\b.{0,30}(without|ignore|bypass|override)/i, weight: 2, label: 'act-as-bypass' },
  { pattern: /\[system\]/i, weight: 2, label: 'system-tag' },
  { pattern: /\[\/?(inst|instruction|sys)\]/i, weight: 2, label: 'llama-tag' },
  { pattern: /&lt;\|.{0,20}\|&gt;|<\|.{0,20}\|>/i, weight: 3, label: 'llm-special-token' },

  // Template injection
  { pattern: /\{\{[^}]{0,100}\}\}/g, weight: 3, label: 'template-injection' },
  { pattern: /\{%[^%]{0,100}%\}/g, weight: 3, label: 'jinja-tag' },

  // XSS / Script tags
  { pattern: /<script\b[^>]*>/i, weight: 3, label: 'script-tag' },
  { pattern: /javascript:/i, weight: 2, label: 'js-protocol' },
  { pattern: /on\w+\s*=/i, weight: 2, label: 'html-event-handler' },

  // Prompt exfiltration
  { pattern: /repeat\s+(the\s+)?(above|system|prompt|instruction)/i, weight: 2, label: 'repeat-exfil' },
  { pattern: /print\s+(your\s+)?(system\s+)?prompt/i, weight: 2, label: 'print-prompt' },
  { pattern: /what\s+(are\s+)?your\s+(system\s+)?instructions/i, weight: 1, label: 'instructions-probe' },

  // Jailbreak roles
  { pattern: /\bdeveloper\s+mode\b/i, weight: 2, label: 'developer-mode' },
  { pattern: /\bjailbreak\b/i, weight: 3, label: 'jailbreak' },
  { pattern: /\bDAN\b/, weight: 2, label: 'dan-attack' },

  // Math SSTI probe
  { pattern: /\$\{\s*\d+\s*\*\s*\d+\s*\}/g, weight: 3, label: 'ssti-math' },
  { pattern: /\{\{\s*\d+\s*\*\s*\d+\s*\}\}/g, weight: 3, label: 'ssti-math-handlebars' },
];

const INJECTION_THRESHOLD = 3;

// ── 2. Output validation patterns (AI response sanitization) ─────────────────
const RESPONSE_BLOCKLIST: RegExp[] = [
  /SYSTEM\s*PROMPT:/i,
  /As an AI language model, I (cannot|must|will)/i,
  /<script\b[^>]*>/i,
  /\{\{[^}]{0,100}\}\}/g,
];

// ── 3. Text normalization ─────────────────────────────────────────────────────
function normalizeInput(raw: string): string {
  const nfc = raw.normalize('NFC');

  return nfc
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// ── 4. Public API ─────────────────────────────────────────────────────────────
export interface InjectionCheckResult {
  isInjection: boolean;
  score: number;
  matchedLabels: string[];
}

export function checkPromptInjection(input: string): InjectionCheckResult {
  if (!input || typeof input !== 'string') {
    return { isInjection: false, score: 0, matchedLabels: [] };
  }

  const normalized = normalizeInput(input);
  let score = 0;
  const matchedLabels: string[] = [];

  for (const { pattern, weight, label } of INJECTION_PATTERNS) {
    if (pattern.global) pattern.lastIndex = 0;
    if (pattern.test(normalized)) {
      score += weight;
      matchedLabels.push(label);
    }
  }

  return {
    isInjection: score >= INJECTION_THRESHOLD,
    score,
    matchedLabels,
  };
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
    .trim();
}

export function sanitizeAiResponse(response: string): string {
  if (!response || typeof response !== 'string') return '';

  let sanitized = response;

  for (const pattern of RESPONSE_BLOCKLIST) {
    if (pattern.global) pattern.lastIndex = 0;
    if (pattern.test(sanitized)) {
      logger.warn('[AI Guard] Blocked pattern found in AI response output — redacting');
      sanitized = sanitized.replace(pattern, '[content removed]');
    }
  }

  return convertMarkdownToWhatsApp(sanitized.trim());
}
