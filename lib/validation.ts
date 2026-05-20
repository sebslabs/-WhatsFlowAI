import { NextRequest, NextResponse } from 'next/server'
import { ZodObject, ZodError } from 'zod'
import { handleApiError } from './errors'

interface ValidationSchemas {
  body?: ZodObject<any>
  query?: ZodObject<any>
  params?: ZodObject<any>
}

/**
 * Enterprise-grade Zero-Trust request validation wrapper for Next.js API Routes.
 * Intercepts, validates, and parses incoming request body, query, and dynamic parameters.
 * Rejects any malformed or missing schemas immediately prior to route execution.
 */
export function withValidation(
  schemas: ValidationSchemas,
  handler: (req: NextRequest, context: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: any) => {
    try {
      // 1. Authenticate & Authorize Context Check (Validated by global middleware.ts)
      const userId = req.headers.get('x-user-id')
      const tenantId = req.headers.get('x-tenant-id')

      // Secure boundary check
      if (!userId || !tenantId) {
        return NextResponse.json(
          { error: 'Unauthorized request context. Missing tenant authentication.', code: 'UNAUTHORIZED' },
          { status: 401 }
        )
      }

      // 2. Validate URL Query Parameters
      if (schemas.query) {
        const { searchParams } = new URL(req.url)
        const queryObj = Object.fromEntries(searchParams.entries())
        const parsedQuery = await schemas.query.parseAsync(queryObj)
        // Safely attach to the request object
        ;(req as any).validatedQuery = parsedQuery
      }

      // 3. Validate Route Dynamic Parameters (e.g. [id])
      if (schemas.params && context?.params) {
        const parsedParams = await schemas.params.parseAsync(context.params)
        context.validatedParams = parsedParams
      }

      // 4. Validate Request Body
      if (schemas.body) {
        let bodyObj: any
        try {
          // Clone the request stream to prevent body-consumed errors downstream
          bodyObj = await req.clone().json()
        } catch {
          return NextResponse.json(
            { error: 'Malformed or missing JSON body', code: 'VALIDATION_ERROR' },
            { status: 400 }
          )
        }

        const parsedBody = await schemas.body.parseAsync(bodyObj)
        ;(req as any).validatedBody = parsedBody
      }

      // 5. Safe downstream execution
      return await handler(req, context)
    } catch (e: unknown) {
      if (e instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: e.issues.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          { status: 400 }
        )
      }

      return handleApiError(e, 'Request validation execution failed')
    }
  }
}
