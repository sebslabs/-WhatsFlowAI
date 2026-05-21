/**
 * Correlation ID Middleware
 *
 * Attaches a unique correlation ID to every incoming HTTP request.
 * The ID is propagated through async context so all logs from the same
 * request automatically include it — no passing needed.
 *
 * Header: X-Correlation-Id (read from request if present, otherwise generated)
 * Response: X-Correlation-Id is echoed back for client-side debugging
 */

import type { Request, Response, NextFunction } from 'express'
import { logStorage, generateCorrelationId, logger } from '../utils/logger.js'

export function correlationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId =
    (req.headers['x-correlation-id'] as string | undefined) ?? generateCorrelationId()

  // Echo the correlation ID back so clients can trace their requests
  res.setHeader('X-Correlation-Id', correlationId)

  // Run the rest of the request inside an async context with the correlation ID
  logStorage.run({ correlationId }, () => {
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path:   req.path,
      ip:     req.ip,
      ua:     req.headers['user-agent'],
    })
    next()
  })
}

/**
 * Request latency logging middleware.
 * Logs response time on finish.
 */
export function latencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now()

  res.on('finish', () => {
    const latencyMs = Date.now() - start
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info'

    logger[level](`${req.method} ${req.path} → ${res.statusCode}`, {
      statusCode: res.statusCode,
      latencyMs,
      method: req.method,
      path: req.path,
    })
  })

  next()
}
