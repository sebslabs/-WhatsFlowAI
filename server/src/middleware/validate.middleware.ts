/**
 * Zod request validation middleware for Express.
 *
 * Usage:
 *   router.post('/leads', authenticate, validate(createLeadSchema), APIController.createLead)
 *
 * Attaches the parsed+validated body to req.body so downstream handlers
 * receive typed, safe data instead of raw untrusted input.
 */

import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'
import { ZodError } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Replace req.body with the validated (and coerced) result
      req.body = schema.parse(req.body)
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(422).json({
          error: 'Validation failed',
          details: err.flatten().fieldErrors,
        })
        return
      }
      next(err)
    }
  }
}

/**
 * Validates query parameters against a schema.
 * Usage: router.get('/leads', authenticate, validateQuery(paginationSchema), ...)
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as typeof req.query
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(422).json({
          error: 'Invalid query parameters',
          details: err.flatten().fieldErrors,
        })
        return
      }
      next(err)
    }
  }
}

/**
 * Validates route params (e.g. :id must be a UUID).
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as typeof req.params
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(422).json({
          error: 'Invalid route parameters',
          details: err.flatten().fieldErrors,
        })
        return
      }
      next(err)
    }
  }
}
