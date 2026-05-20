import type { Response } from 'express'
import { logger } from './logger.js'

/**
 * Enterprise-grade safe error responder for Express.
 * Strictly prevents leaking system internals, databases, or message traces
 * to any clients. Always responds with the standard hardened error object.
 */
export function sendSafeError(res: Response, err: unknown, statusCode = 500): void {
  const errMsg = err instanceof Error ? err.message : String(err)
  const errStack = err instanceof Error ? err.stack : undefined

  // 1. Log full trace internally only
  logger.error('API endpoint execution exception', { err: errMsg, stack: errStack })

  // 2. Respond to the client with the strictly hardened GENERIC_ERROR schema
  res.status(statusCode).json({
    error: 'Internal server error',
    code: 'GENERIC_ERROR',
  })
}
