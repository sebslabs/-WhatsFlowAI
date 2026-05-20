# WhatsFlow AI: Enterprise-Grade Architecture & Security Blueprint

As a Senior SaaS Architect and Security Engineer, I have designed this zero-trust, enterprise-ready architecture for **WhatsFlow AI**. This blueprint guarantees multi-tenant isolation, impenetrable API security, and highly scalable infrastructure safe for handling sensitive business data and real customers.

---

## 1. SYSTEM ARCHITECTURE

We utilize a **Zero-Trust Edge-to-Database Architecture**, ensuring every request is cryptographically verified, validated, and strictly authorized.

### Request Lifecycle & Secure Communication Flow
```text
[ Client (Browser / Mobile) ]
        │
   (HTTPS TLS 1.3 / JWT in HttpOnly, Secure, SameSite=Strict Cookies)
        ▼
[ Vercel Edge Network / WAF ] ──────── (DDoS Protection, Basic Rate Limiting)
        │
        ▼
[ Next.js Edge Middleware ] ────────── (Validates Session, RBAC, Tenant Context)
        │
        ▼
[ Next.js App Router (React Server Components + API Routes) ]
        │
   (Server-to-Server encrypted communication / Zod Validation / Upstash Redis Rate Limiting)
        ▼
[ Supabase Platform ]
   ├── Auth GoTrue API (Manages JWT issuance and revocation)
   └── PostgreSQL Database (RLS Enforces strict tenant isolation)

[ Meta WhatsApp API ]
        │
   (POST with X-Hub-Signature-256)
        ▼
[ Webhook Endpoint (/api/webhooks/whatsapp) ]
        │
   (HMAC SHA256 Validation against raw body) ───▶ (Reject instantly if invalid)
        │
   (Upstash Kafka / BullMQ Queue) ──────────────▶ (Ensures reliability and scaling)
        │
   (n8n / Node.js Worker) ──────────────────────▶ (Orchestrates OpenAI & Database)
```

---

## 2. AUTHENTICATION (CRITICAL)

**Rule: NEVER use `localStorage` for authentication tokens.**
We implement **Supabase SSR**, leveraging HttpOnly, Secure cookies to prevent XSS attacks from stealing tokens.

### Secure Route Protection Middleware (`middleware.ts`)
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

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

  const { data: { user } } = await supabase.auth.getUser()

  // Protect sensitive routes
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

---

## 3. ROLE-BASED ACCESS CONTROL (RBAC)

Roles are managed securely in the database, isolated from client manipulation.

### RBAC Utility (`lib/auth/rbac.ts`)
```typescript
import { createClient } from '@/lib/supabase/server'

export async function requireRole(allowedRoles: ('admin' | 'user')[]) {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (!user || error) throw new Error('Unauthorized')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !allowedRoles.includes(profile.role)) {
    throw new Error('Forbidden: Insufficient privileges')
  }

  return { user, role: profile.role }
}
```

---

## 4. API SECURITY (ZERO TRUST)

All APIs operate on a **Deny by Default** principle.

### Secure API Example (`app/api/contacts/route.ts`)
```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
const rateLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "10 s") })

const ContactSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format"),
  name: z.string().min(1).max(100).trim().escape(), // Basic sanitization
})

export async function POST(request: Request) {
  try {
    // 1. Rate Limiting based on IP
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1"
    const { success } = await rateLimit.limit(`api_limit_${ip}`)
    if (!success) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })

    // 2. Authentication Check
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 3. Payload Validation
    const body = await request.json()
    const validatedData = ContactSchema.parse(body)

    // 4. Secure Database Insertion (tenant_id enforced via RLS)
    const { data, error } = await supabase
      .from('contacts')
      .insert({ ...validatedData, tenant_id: user.id })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

---

## 5. MULTI-TENANT DATABASE (VERY CRITICAL)

Every query relies on **Row Level Security (RLS)**. Even if an API accidentally omits a `tenant_id` filter, the database will block the query.

### SQL Schema & RLS
```sql
CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Deny access by default (implicit)

-- Strict Policies
CREATE POLICY "Tenant Isolation: Select" ON contacts
  FOR SELECT USING (auth.uid() = tenant_id);

CREATE POLICY "Tenant Isolation: Insert" ON contacts
  FOR INSERT WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Tenant Isolation: Update" ON contacts
  FOR UPDATE USING (auth.uid() = tenant_id);

CREATE POLICY "Tenant Isolation: Delete" ON contacts
  FOR DELETE USING (auth.uid() = tenant_id);
```

---

## 6. WHATSAPP WEBHOOK SECURITY

Meta webhooks must be verified using `HMAC SHA256` against the **exact raw request body** to prevent spoofing.

### Webhook Controller (`app/api/webhooks/whatsapp/route.ts`)
```typescript
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const config = {
  api: { bodyParser: false }, // Crucial for reading raw body
}

function verifySignature(rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader) return false
  const secret = process.env.META_APP_SECRET!
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const expectedSignature = `sha256=${hash}`
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature))
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')

  if (!verifySignature(rawBody, signature)) {
    console.warn('Webhook Spoofing Attempt Detected!')
    return NextResponse.json({ error: 'Invalid Signature' }, { status: 403 })
  }

  // Safe to process payload
  const payload = JSON.parse(rawBody)
  // Dispatch to background worker...

  return NextResponse.json({ status: 'received' }, { status: 200 })
}
```

---

## 7. DATABASE SECURITY

- **No Raw SQL Strings**: Exclusively use `@supabase/supabase-js` query builders.
- **Service Role Key Secrecy**: The Supabase `service_role` key can bypass RLS. NEVER expose it to the client. Only use it in trusted backend workers when absolutely necessary (e.g., webhook background processing).
- **Backups**: Implement automated daily PITR (Point-in-Time Recovery) backups in Supabase.

---

## 8. FRONTEND SECURITY

- **Environment Variables**: Only use `NEXT_PUBLIC_` for safe client configurations (e.g., public URLs). Never for API keys.
- **XSS Prevention**: React automatically escapes DOM injections. For rich text or AI chat outputs, sanitize using `DOMPurify` before rendering `dangerouslySetInnerHTML`.
- **CSRF Protection**: Rely on Next.js Server Actions and secure SameSite cookies.

---

## 9. DEPLOYMENT SECURITY

- **Secrets Management**: Do not commit `.env` files. Use Vercel's secure environment variable manager.
- **Dependency Scanning**: Enforce `npm audit` in CI/CD. Use Dependabot or Snyk.
- **Log Masking**: Ensure `Pino` or `Winston` is configured to redact passwords, JWTs, and PII before shipping to log aggregators.

---

## 10. AI SAFETY (IMPORTANT)

- **Strict System Prompts**: Confine the AI's operational boundaries.
  *"You are a customer service bot for Company X. You must only answer questions regarding Company X. If asked about unrelated topics, reply: 'I can only assist with Company X inquiries.'"*
- **Human Handoff**: Monitor conversation sentiment. If negative sentiment > 0.8, immediately flag the database record `requires_human: true` and pause AI routing.
- **Tenant Usage Limits**: Track OpenAI token usage per `tenant_id` via Redis to prevent one compromised tenant from draining platform resources.

---

## 11. LOGGING & MONITORING

```typescript
import pino from 'pino'

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: ['req.headers.authorization', 'user.password', 'phone'],
})
```
- Integrate **Sentry** (`@sentry/nextjs`) to capture unhandled promise rejections and React component crashes.

---

## 12. FOLDER STRUCTURE

```text
whatsflow-ai/
├── app/
│   ├── (auth)/             # Secure login/registration flows
│   ├── (dashboard)/        # RBAC protected admin/user panels
│   ├── api/
│   │   ├── internal/       # Rate-limited REST endpoints for the frontend
│   │   └── webhooks/       # Cryptographically verified external inputs
│   └── layout.tsx
├── components/
│   ├── ui/                 # Dumb UI components (buttons, inputs)
│   └── secure/             # Components handling sensitive data display
├── lib/
│   ├── supabase/           # Client/Server initialization wrappers
│   ├── auth/               # RBAC and session utilities
│   ├── rate-limit.ts       # Upstash Redis configuration
│   └── validations.ts      # Zod schemas (Single Source of Truth)
├── services/
│   ├── ai.service.ts       # OpenAI orchestration with token tracking
│   └── meta.service.ts     # WhatsApp Cloud API interactions
├── middleware.ts           # Global route protection
└── supabase/
    └── migrations/         # Version-controlled SQL for RLS and schema
```

---

## 13. PRODUCTION CHECKLIST

- [ ] **Zero-Trust Validation**: Every API route extracts user session server-side and validates payloads via Zod.
- [ ] **RLS Audit**: Executed queries without a session to verify data cannot be accessed.
- [ ] **Cookie Security**: Confirmed session cookies are `HttpOnly` and `Secure`.
- [ ] **Webhook Validation**: Verified that invalid `X-Hub-Signature-256` headers correctly return `403`.
- [ ] **Rate Limiting**: Stress-tested login and webhook endpoints to confirm rate limits trigger correctly.
- [ ] **Environment Review**: Ensured no sensitive keys (Supabase Service Role, OpenAI Key, Meta App Secret) contain the `NEXT_PUBLIC_` prefix.
- [ ] **AI Guardrails**: Tested edge-case prompts to ensure the AI does not hallucinate or leak internal system instructions.
