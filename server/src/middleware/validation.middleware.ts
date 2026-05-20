import type { Request, Response, NextFunction } from 'express'
import { ZodObject, ZodError } from 'zod'

interface ExpressValidationSchemas {
  body?: ZodObject<any>
  query?: ZodObject<any>
  params?: ZodObject<any>
}

/**
 * Enterprise-grade Zero-Trust validation middleware for Express controllers.
 * Intercepts incoming requests and parses inputs against strict Zod schemas.
 * Instantly blocks execution and returns a VALIDATION_ERROR on mismatch.
 */
export function validate(schemas: ExpressValidationSchemas) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Verify Authentication Context Headers
      const tenantId = req.headers['x-tenant-id']
      const userId = req.headers['x-user-id']

      const isInternal = req.path.startsWith('/internal') || req.headers['x-internal-key']
      const isPublicWebhook = req.path.startsWith('/webhook')

      if (!isInternal && !isPublicWebhook && (!tenantId || !userId)) {
        res.status(401).json({
          error: 'Unauthorized request context. Missing tenant authentication.',
          code: 'UNAUTHORIZED'
        })
        return
      }

      // 2. Validate URL Query Parameters
      if (schemas.query) {
        req.query = (await schemas.query.parseAsync(req.query)) as any
      }

      // 3. Validate Path Route Parameters
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(req.params)) as any
      }

      // 4. Validate JSON Request Body
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body)
      }

      next()
    } catch (e: unknown) {
      if (e instanceof ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: e.issues.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        })
        return
      }
      next(e)
    }
  }
}
