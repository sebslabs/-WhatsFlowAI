/**
 * Map agent/UI model ids to OpenRouter model slugs.
 * When OPENROUTER_API_KEY is set, all chat completions go through OpenRouter.
 */
const OPENROUTER_DEFAULT = process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-2.0-flash-001'

export function resolveOpenRouterModel(modelStr?: string | null): string {
  if (!modelStr?.trim()) return OPENROUTER_DEFAULT

  let m = modelStr.trim()

  if (m.startsWith('openrouter/')) {
    m = m.slice('openrouter/'.length)
  }

  if (m.includes('/')) return m

  const lower = m.toLowerCase()

  if (lower.includes('mistral-large') || lower === 'mistral-large-latest') {
    return 'mistralai/mistral-large'
  }
  if (lower.includes('mistral-small') || lower === 'mistral-small-latest') {
    return 'mistralai/mistral-small'
  }
  if (lower.includes('mixtral')) return 'mistralai/mixtral-8x7b-instruct'
  if (lower.includes('gemini-2') || lower.includes('gemini-2.0')) {
    return 'google/gemini-2.0-flash-001'
  }
  if (lower.includes('gemini-1.5-pro')) return 'google/gemini-pro-1.5'
  if (lower.includes('gemini')) return 'google/gemini-2.0-flash-001'
  if (lower.includes('gpt-4o-mini') || lower.includes('gpt-4o')) return 'openai/gpt-4o-mini'
  if (lower.includes('gpt-4')) return 'openai/gpt-4-turbo'
  if (lower.includes('claude-3-5-sonnet') || lower.includes('claude')) {
    return 'anthropic/claude-3.5-haiku'
  }
  if (lower.includes('llama-3.3') || lower.includes('llama-3.3-70b')) {
    return 'meta-llama/llama-3.3-70b-instruct'
  }
  if (lower.includes('llama-3.1-8b') || lower.includes('llama')) {
    return 'meta-llama/llama-3.1-8b-instruct'
  }
  if (lower.includes('deepseek')) return 'deepseek/deepseek-chat'
  if (lower.includes('groq')) return 'meta-llama/llama-3.3-70b-instruct'

  return OPENROUTER_DEFAULT
}

export function shouldUseOpenRouterOnly(): boolean {
  const key = process.env.OPENROUTER_API_KEY
  return !!key && key.length > 10 && key !== 'your_openrouter_api_key'
}
