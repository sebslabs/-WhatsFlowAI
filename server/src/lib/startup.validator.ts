/**
 * Startup Validator
 *
 * Runs BEFORE the HTTP server binds. Validates:
 *  - Required environment variables
 *  - Database connectivity + schema readiness
 *  - Redis connectivity
 *  - Encryption key format
 *  - Supabase table existence
 *
 * If any check fails → process.exit(1) with a clear error.
 * This guarantees the server never starts in a broken state.
 */

import { createClient } from '@supabase/supabase-js'
import { Redis } from 'ioredis'
import { logger } from '../utils/logger.js'

// ── Required Env Vars ─────────────────────────────────────────────────────────

const REQUIRED_ENV: string[] = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'ALLOWED_ORIGIN',
  'META_APP_SECRET',
]

const ENCRYPTION_REQUIRED_IF_TOKENS = 'ENCRYPTION_KEY'

// ── Tables that MUST exist before starting ───────────────────────────────────

const REQUIRED_TABLES = [
  'tenants',
  'tenant_members',
  'profiles',
  'contacts',
  'conversations',
  'messages',
  'whatsapp_accounts',
  'chatbot_flows',
  'ai_agents',
  'billing_subscriptions',
  'webhook_events',
  'usage_logs',
]

// ── Checks ────────────────────────────────────────────────────────────────────

async function checkEnvVars(): Promise<void> {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Encryption key format check
  const encKey = process.env[ENCRYPTION_REQUIRED_IF_TOKENS]
  if (encKey && encKey.length !== 64) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ` +
      `Got length ${encKey.length}. Generate with: openssl rand -hex 32`
    )
  }

  logger.info('[startup] Environment variables ✓')
}

async function checkDatabase(): Promise<void> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check each required table with a lightweight head query
  const failures: string[] = []

  await Promise.all(
    REQUIRED_TABLES.map(async (table) => {
      const { error } = await supabase.from(table).select('id', { count: 'exact', head: true }).limit(1)
      if (error) {
        failures.push(`${table}: ${error.message}`)
      }
    })
  )

  if (failures.length > 0) {
    throw new Error(
      `Database schema check failed. Missing or inaccessible tables:\n` +
      failures.map((f) => `  • ${f}`).join('\n') +
      `\nRun the latest migration: supabase db push`
    )
  }

  // Check that leads has flow tracking columns
  const { error: colError } = await supabase
    .from('leads')
    .select('current_flow_id, current_step_index')
    .limit(0)

  if (colError) {
    throw new Error(
      `leads.current_flow_id / current_step_index columns missing. ` +
      `Run migration: 20260513000000_production_sync_patch.sql`
    )
  }

  logger.info(`[startup] Database schema ✓ (${REQUIRED_TABLES.length} tables verified)`)
}

async function checkRedis(): Promise<void> {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  const redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    connectTimeout: 5_000,
    tls: url.startsWith('rediss://') ? {} : undefined,
  })

  try {
    const pong = await redis.ping()
    if (pong !== 'PONG') throw new Error('Redis PING returned unexpected response')
    logger.info('[startup] Redis ✓')
  } finally {
    redis.disconnect()
  }
}

// ── Main Startup Validation ───────────────────────────────────────────────────

export async function validateStartup(): Promise<void> {
  logger.info('[startup] Running pre-flight checks…')

  const checks: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: 'Environment',  fn: checkEnvVars   },
    { name: 'Database',     fn: checkDatabase  },
    { name: 'Redis',        fn: checkRedis     },
  ]

  let failed = false

  for (const check of checks) {
    try {
      await check.fn()
    } catch (err) {
      logger.error(`[startup] ❌ ${check.name} check failed`, {
        err: (err as Error).message,
      })
      failed = true
    }
  }

  if (failed) {
    logger.error('[startup] Pre-flight checks failed. Server will NOT start.')
    process.exit(1)
  }

  logger.info('[startup] ✅ All pre-flight checks passed. Server ready.')
}
