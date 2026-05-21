/**
 * Centralized configuration loader with startup fail-fast validation.
 * Enforces Zero-Trust credential management by rejecting hardcoded fallbacks
 * and immediately stopping execution if required secrets are missing.
 */

function getEnv(key: string, required = true): string {
  const value = process.env[key];
  if (!value && required) {
    throw new Error(`CRITICAL: Environment variable "${key}" is missing. Execution stopped.`);
  }
  return value || '';
}

export const config = {
  // Supabase
  supabaseUrl: getEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseServiceKey: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseAnonKey: getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', false),

  // Meta / WhatsApp (Optional if using QR/Baileys only)
  metaAppSecret: getEnv('META_APP_SECRET', false),
  metaVerifyToken: getEnv('META_VERIFY_TOKEN', false) || getEnv('WHATSAPP_VERIFY_TOKEN', false),

  // OpenRouter (Optional if using other AI providers or AI is disabled)
  openrouterApiKey: getEnv('OPENROUTER_API_KEY', false),

  // AI & Language Model Keys (Optional based on configuration, but no hardcoded fallbacks allowed)
  geminiApiKey: getEnv('GEMINI_API_KEY', false),
  groqApiKey: getEnv('GROQ_API_KEY', false),
  openaiApiKey: getEnv('OPENAI_API_KEY', false),
  mistralApiKey: getEnv('MISTRAL_API_KEY', false),

  // Session & Encryption Key
  encryptionKey: getEnv('ENCRYPTION_KEY', false),
};

// Validate critical secrets at startup (Fail-Fast pattern)
export function validateConfig() {
  const coreRequiredKeys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  for (const key of coreRequiredKeys) {
    if (!process.env[key]) {
      throw new Error(`CRITICAL STARTUP FAILURE: Required environment variable "${key}" is not set.`);
    }
  }

  // Meta APP Secret is only required if explicitly enabled or Meta provider is active
  if (process.env.ENABLE_META_WHATSAPP === 'true' || process.env.WHATSAPP_PROVIDER === 'meta') {
    if (!process.env.META_APP_SECRET) {
      throw new Error(`CRITICAL STARTUP FAILURE: META_APP_SECRET must be provided when Meta WhatsApp provider is enabled.`);
    }
  }

  // OpenRouter key is optional unless AI features are enabled and no other provider is configured
  if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    console.warn('[Config] WARNING: No LLM provider API key (OPENROUTER_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, GROQ_API_KEY) is configured. AI automations will fail.');
  }
  
  console.log('[Config] Startup validation passed successfully.');
}

// Run validation immediately on import
validateConfig();
