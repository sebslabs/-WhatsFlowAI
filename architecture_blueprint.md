# WhatsFlow AI: Production-Ready Architecture & Security Blueprint

As a Senior SaaS Architect, I have designed this comprehensive, secure, and highly scalable architecture for **WhatsFlow AI**. This blueprint strictly follows production standards, enforcing zero-trust API security, multi-tenancy at the database level, and strict webhook validation.

---

## 1. SYSTEM ARCHITECTURE

The architecture follows a modern Serverless + Edge model, utilizing Next.js App Router for both the frontend UI and backend API routes, securely interfacing with Supabase for PostgreSQL and Authentication.

### High-Level Request Flow
```text
[ Client (Browser) ]
        │
   (HTTPS / JWT in HttpOnly Cookies)
        ▼
[ Next.js Edge Middleware ] ──────── (Validates Session via Supabase Auth)
        │
        ▼
[ Next.js App Router ]
   ├── Server Components (UI rendering with direct, secure DB access)
   └── API Routes (Backend logic, rate-limited, Zod-validated)
        │
   (Server-Side Supabase Client / Database calls)
        ▼
[ Supabase ]
   ├── PostgreSQL Database (Enforces Multi-Tenancy via RLS)
   └── Auth GoTrue API (Manages JWTs and Users)

[ Meta WhatsApp API ]
        │
   (POST with X-Hub-Signature-256)
        ▼
[ Webhook Endpoint (/api/webhooks/whatsapp) ]
        │
   (HMAC SHA256 Validation) ───▶ (Reject if Invalid)
        │
   (Queue / n8n / OpenAI) ──────▶ (Database Update & Meta API Reply)
```

---

## 2. AUTHENTICATION (CRITICAL)

Client-side `localStorage` authentication is vulnerable to XSS. We will use **Supabase SSR (Server-Side Rendering)** which utilizes secure, HTTP-only cookies.

### Route Protection Middleware (`middleware.ts`)
This middleware intercepts every request, checks the Supabase session, and redirects unauthenticated users away from protected routes.

```typescript
// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Initialize Supabase Server Client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Securely get user session
  const { data: { user } } = await supabase.auth.getUser()

  // Protect Dashboard Routes
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

---

## 3. ROLE-BASED ACCESS CONTROL (RBAC)

RBAC ensures that `admin` users can access billing and global settings, while `member` users are restricted.

### RBAC Utility (`lib/auth/rbac.ts`)
```typescript
import { createClient } from '@/lib/supabase/server' // Server client wrapper

export async function checkRole(requiredRole: 'admin' | 'member') {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (!user || error) throw new Error('Unauthorized')

  // Fetch role from a secure profiles table or JWT app_metadata
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== requiredRole && profile?.role !== 'admin') {
    throw new Error('Forbidden: Insufficient permissions')
  }

  return user
}
```

---

## 4. API SECURITY (DENY BY DEFAULT)

APIs must be protected against abuse using Rate Limiting (e.g., Upstash Redis) and Payload Validation (Zod).

### Secure API Route Example (`app/api/leads/route.ts`)
```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
// import { rateLimit } from '@/lib/rate-limit'

const createLeadSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/), // E.164 format
})

export async function POST(request: Request) {
  try {
    // 1. Rate Limiting (Pseudocode)
    // await rateLimit(request.headers.get('x-forwarded-for'))

    // 2. Authentication Check
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 3. Payload Validation
    const body = await request.json()
    const validatedData = createLeadSchema.parse(body)

    // 4. Database Insertion (RLS protects tenant_id automatically)
    const { data, error } = await supabase
      .from('leads')
      .insert({ ...validatedData, user_id: user.id })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

---

## 5. MULTI-TENANT DATABASE DESIGN (VERY CRITICAL)

Never rely solely on application logic for tenant isolation. **Supabase Row Level Security (RLS)** acts as the ultimate safety net.

### SQL Schema & RLS Policies
```sql
-- 1. Create tables with tenant reference (user_id for simplicity, or tenant_id for B2B)
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Users can only SELECT their own leads
CREATE POLICY "Users can view own leads" ON leads
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only INSERT their own leads
CREATE POLICY "Users can insert own leads" ON leads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only UPDATE their own leads
CREATE POLICY "Users can update own leads" ON leads
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only DELETE their own leads
CREATE POLICY "Users can delete own leads" ON leads
  FOR DELETE USING (auth.uid() = user_id);
```

---

## 6. WHATSAPP WEBHOOK SECURITY

Meta sends webhooks with an `X-Hub-Signature-256` header. We **must** use the raw request buffer to hash the payload and verify authenticity.

### Webhook Route (`app/api/webhooks/whatsapp/route.ts`)
```typescript
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Next.js App Router requires this to access the raw body
export const config = {
  api: { bodyParser: false },
}

async function verifyMetaSignature(req: Request, rawBody: string) {
  const signature = req.headers.get('x-hub-signature-256')
  if (!signature) return false

  const appSecret = process.env.META_APP_SECRET!
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(req: Request) {
  const rawBody = await req.text() // Read raw text for hashing
  
  if (!(await verifyMetaSignature(req, rawBody))) {
    console.error('Webhook signature verification failed')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = JSON.parse(rawBody)
  // Process webhook safely...
  
  return NextResponse.json({ success: true }, { status: 200 })
}
```

---

## 7. DATABASE SECURITY & BEST PRACTICES

- **No Raw SQL**: Always use the Supabase typed client (`@supabase/supabase-js`). This inherently prevents SQL injection.
- **Service Role Key**: Never use the `service_role` key in the frontend. Only use it in secure, server-side cron jobs or admin routes when bypassing RLS is explicitly required.
- **Backups**: Enable Point-in-Time Recovery (PITR) in Supabase Pro to prevent catastrophic data loss.

---

## 8. FRONTEND SECURITY

- **Secrets**: Environment variables without the `NEXT_PUBLIC_` prefix are entirely safe and remain on the server. Never expose API keys or secrets to the client.
- **XSS Prevention**: React automatically escapes strings. However, if rendering markdown for AI responses, strictly use a library like `DOMPurify` to sanitize outputs before rendering.
- **CSRF**: Next.js Server Actions and standard APIs utilize Same-Site cookies and fetch protections, naturally mitigating most CSRF attacks.

---

## 9. ENVIRONMENT & DEPLOYMENT SECURITY

- **.env**: Add `.env`, `.env.local` to `.gitignore`.
- **Vercel Settings**: Enforce strict Environment variables in the Vercel dashboard. Separate Production, Preview, and Development environments.
- **Logs**: Do not `console.log(user)` or `console.log(secrets)` in production. Use a dedicated logger.
- **Audit**: Add `npm audit` to the CI/CD pipeline.

---

## 10. AI AUTOMATION SAFETY

When connecting OpenAI to WhatsApp via n8n or Next.js APIs:
1. **System Prompt Guardrails**: Strictly constrain the AI's persona. *"You are a helpful assistant for Company X. Never discuss topics outside of Company X's products. If you do not know the answer, say exactly 'Let me transfer you to a human agent.' "*
2. **Human Handoff**: If the AI detects sentiment drop or fails twice, flag the conversation in Supabase and notify a human agent. Stop routing messages to OpenAI for that specific `conversation_id`.
3. **Usage Limits**: Track OpenAI token usage per `tenant_id` to prevent billing attacks or runaway loops.

---

## 11. LOGGING & MONITORING

Implement a structured logging strategy.
```typescript
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() }
    },
  },
})

// Usage in API:
// logger.info({ userId: user.id, event: 'LOGIN_SUCCESS', ip: req.ip })
```
- Integrate **Sentry** for automatic error tracking and unhandled exception monitoring.

---

## 12. FOLDER STRUCTURE

```text
whatsflow-ai/
├── app/
│   ├── (auth)/             # Login, Signup, Callback routes
│   ├── (dashboard)/        # Protected dashboard pages
│   ├── api/                # API Routes (Backend)
│   │   ├── webhooks/       # External webhooks (WhatsApp, Stripe)
│   │   └── internal/       # Client-facing APIs
│   └── layout.tsx
├── components/
│   ├── ui/                 # Reusable Radix/Shadcn UI components
│   └── features/           # Complex domain components (e.g. ChatInterface)
├── lib/
│   ├── supabase/           # Supabase server/client/middleware initializers
│   ├── utils.ts            # General helpers
│   └── validations/        # Zod schemas shared across FE/BE
├── services/               # Core Business Logic
│   ├── openai.service.ts
│   └── whatsapp.service.ts
├── middleware.ts           # Global Auth & Route Protection
└── supabase/
    ├── migrations/         # SQL Migrations for schema & RLS
    └── types.ts            # Generated TypeScript types from DB
```

---

## 13. PRODUCTION CHECKLIST

- [ ] **RLS Enforced**: Verified every single table has `ENABLE ROW LEVEL SECURITY` and correct policies.
- [ ] **Auth Strategy Verified**: All client-side auth state relies on HTTP-only cookies managed by `@supabase/ssr`.
- [ ] **Webhook Hashes**: Meta `X-Hub-Signature-256` is actively verified using the raw request buffer.
- [ ] **Rate Limiting Active**: Upstash Redis or similar rate limiter applied to login, signup, and webhook endpoints.
- [ ] **Secrets Audited**: Scanned codebase to ensure no `NEXT_PUBLIC_` prefixes were accidentally applied to sensitive keys.
- [ ] **Error Handling**: API routes return generic error messages to the client and log stack traces privately to Sentry/Pino.
