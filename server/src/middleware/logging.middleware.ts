import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../index.js';

// Sensitive fields we don't want in request/response JSON body logs
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'access_token',
  'secret',
  'key',
  'authorization',
  'otp',
  'totp',
  'code',
  'refresh_token',
];

function redactSensitives(obj: any): any {
  if (!obj) return obj;
  if (typeof obj !== 'object') return obj;
  
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in copy) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
      copy[key] = '[REDACTED]';
    } else if (typeof copy[key] === 'object') {
      copy[key] = redactSensitives(copy[key]);
    }
  }
  return copy;
}

export function apiLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const oldWrite = res.write;
  const oldEnd = res.end;
  const chunks: Buffer[] = [];

  // Monkey-patch response output methods to capture final response body
  res.write = function (...args: any[]) {
    const chunk = args[0];
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return oldWrite.apply(res, args as any);
  };

  res.end = function (...args: any[]) {
    const chunk = args[0];
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    
    const responseBodyStr = Buffer.concat(chunks).toString('utf8')
    const maxStored = 4096

    // Use async self-invoking function so we don't block the end of response
    ;(async () => {
      try {
        let parsedResBody: unknown = null
        try {
          parsedResBody = JSON.parse(responseBodyStr) as unknown
        } catch {
          parsedResBody = { raw: responseBodyStr.substring(0, 1000) }
        }
        const redacted = redactSensitives(parsedResBody)
        let forStore: unknown = redacted
        const serialized = JSON.stringify(redacted)
        if (serialized.length > maxStored) {
          forStore = {
            _truncated: true,
            length: serialized.length,
            preview: serialized.slice(0, maxStored),
          }
        }

        // Get user info if present (attached by auth.middleware)
        const user = (req as any).user;
        
        // Insert into supabase via service role client
        await supabase
          .from('api_logs')
          .insert({
            tenant_id: user?.organizationId || null,
            user_id: user?.id || null,
            endpoint: req.originalUrl || req.url,
            method: req.method,
            request_body: req.method !== 'GET' ? redactSensitives(req.body) : null,
            response_body: forStore,
            status_code: res.statusCode,
            ip_address: req.ip || req.socket.remoteAddress,
            user_agent: req.get('User-Agent')
          });
      } catch (err) {
        console.error('[logging-mw] Error saving API log:', err);
      }
    })();

    return oldEnd.apply(res, args as any);
  };

  next();
}
