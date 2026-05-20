import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * Enterprise-grade global API error helper for Next.js routes.
 * Enforces security best practices by strictly hiding all raw database,
 * schema layout, ORM, and application details from the client.
 */
export function handleApiError(err: unknown, contextMessage = 'API processing failed'): NextResponse {
  const errMsg = err instanceof Error ? err.message : String(err)
  const errStack = err instanceof Error ? err.stack : undefined

  // 1. Log full error internally only
  logger.error(
    { err: errMsg, stack: errStack },
    `[API Error] ${contextMessage}`
  )

  // 2. Respond to the client with a strictly hardened, generic error schema
  return NextResponse.json(
    {
      error: 'Internal server error',
      code: 'GENERIC_ERROR',
    },
    { status: 500 }
  )
}
