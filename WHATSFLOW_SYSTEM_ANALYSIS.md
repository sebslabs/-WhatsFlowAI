# WhatsFlow AI — Complete System Analysis

**Product:** WhatsApp lead-conversion SaaS  
**Stack:** Next.js 14, Express, Supabase (Postgres + RLS), Redis/BullMQ, Socket.IO, Meta WhatsApp API, Paddle  
**Date:** 2026-05-18

---

## PART 1: FULL SYSTEM ANALYSIS

### 1. Architecture Analysis

#### Component Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER (Browser / Mobile)                          │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Next.js 14 (app/)        │
                    │   - Dashboard UI           │
                    │   - BFF API (app/api/)     │
                    │   - middleware.ts (auth)   │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Express (5000)  │   │ Supabase        │   │ Upstash Redis   │
│ server/src/     │   │ Postgres + RLS  │   │ Rate limits     │
│ - Webhooks      │   │ Auth + Storage  │   └─────────────────┘
│ - Socket.IO     │   │ pgvector (RAG)  │
│ - BullMQ workers│   └─────────────────┘
└────────┬────────┘
         │
    ┌────┴────┬──────────────┬─────────────┐
    ▼         ▼              ▼             ▼
 Meta API  OpenAI/etc    Baileys QR    Paddle
 (Cloud)   (AIGateway)   (unofficial)  (billing)
```

| Layer | Path | Responsibility |
|-------|------|----------------|
| Frontend | `app/dashboard/`, `components/` | Inbox, leads, campaigns, QR connect, settings |
| BFF API | `app/api/*` | CRUD, auth-gated, tenant-scoped Supabase queries |
| Express API | `server/src/` | Webhooks, realtime, heavy processing, queues |
| Workers | `server/src/workers/` | `webhook.worker`, `baileys.worker` |
| AI | `services/ai-gateway.ts` | Injection guard → rate limit → RAG → provider routing |
| Realtime | `server/src/lib/realtime.ts` | Socket.IO broadcast to inbox clients |

#### Data Flow (Inbound WhatsApp Message)

1. Meta POST → `app/api/webhooks/whatsapp` or Express `/webhook`
2. HMAC verify (`lib/utils/webhook-hmac.ts`)
3. Enqueue BullMQ job → `webhook.worker`
4. Worker: upsert contact, conversation, message (tenant-scoped)
5. If AI mode: call `AIGateway.generateResponse()` → RAG → LLM
6. Outbound send via Meta API or Baileys queue
7. Socket.IO broadcast → dashboard inbox updates

#### Single Points of Failure

| SPOF | Impact | Mitigation |
|------|--------|------------|
| Supabase | Full outage | Connection pooling, read replicas (future) |
| Redis | Queues stall, rate limits fail-closed | Upstash HA, monitor queue depth |
| Single Express instance | Webhook/realtime down | Fly.io replicas + sticky sessions for Socket.IO |
| OpenAI embeddings | RAG degraded | Cache (implemented), fallback to non-RAG reply |
| Baileys in Next process | OOM, restarts kill sessions | **Move to dedicated container** (recommended) |

#### Dual API Surface

- **Next.js `app/api/`**: Session auth via Supabase cookies, RLS-aware client
- **Express `server/src/`**: Service role, webhooks, internal M2M

**Risk:** Logic duplication (leads, messages). **Mitigation:** Prefer Next BFF for UI; Express for async/webhook paths only.

#### Tenant Isolation & Auth

- **Auth:** Supabase JWT in cookies; `getUser()` server-side (not `getSession()`)
- **Tenant:** `tenant_members.tenant_id` (canonical); legacy `profiles.organization_id` being phased out
- **RBAC:** `lib/rbac.ts` — role permissions on API routes
- **2FA:** `speakeasy` dependency present; verify implementation in settings flow before production mandate
- **RLS:** Postgres policies on tenant-scoped tables; service role used only in workers with explicit `tenant_id` filters

---

### 2. Security Audit

#### Critical (Fixed)

| ID | CVSS | Issue | Files | Attack Scenario |
|----|------|-------|-------|-----------------|
| C-1 | 9.1 | Open diagnostic API | `app/api/diagnostic/*` | Enumerate all tenants' messages |
| C-2 | 9.0 | Open internal API | `app/api/internal/*` | Forge outbound WhatsApp messages |
| C-3 | 8.6 | Default verify token | `app/api/whatsapp/connect` | Hijack webhook registration |
| C-4 | 8.1 | Public upload bucket | `app/api/conversations/upload` | Host malware/XSS via SVG |

#### High (Fixed / Open)

| ID | CVSS | Issue | Status |
|----|------|-------|--------|
| H-5 | 7.5 | organization_id IDOR | Fixed in middleware + message delete |
| H-6 | 7.0 | Rate limit bypass | Fixed — fail-closed prod |
| H-7 | 6.5 | CORS no-origin bypass | Fixed in Express |
| H-8 | 6.0 | npm audit non-blocking | Fixed in CI |
| H-9 | 7.0 | Baileys in Next | **Open** — architectural |
| H-10 | 6.5 | Service role overuse | Partial — audit worker queries |

#### Medium (Selected)

| ID | Issue | Files |
|----|-------|-------|
| M-1 | Regex prompt injection bypass | `services/ai-gateway.ts` |
| M-2 | `app/api/diagnose` uses service role | `app/api/diagnose/route.ts` |
| M-3 | Bull Board exposure if enabled | ops config |
| M-4 | Client-supplied tenant headers (stripped) | `middleware.ts` — mitigated |
| M-5 | `test-db` dev endpoint | Gated non-prod |

#### Patched Code Pattern (Internal Routes)

```typescript
// middleware.ts — edge validation
if (isInternal(pathname)) {
  const internalKey = request.headers.get('x-internal-key')
  if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

---

### 3. Code Quality Audit

See `CODE_QUALITY.md` for scores and anti-patterns.

**Key inconsistency resolved:** Middleware and `requireAuthApi` now align on `tenant_members.tenant_id`.

---

### 4. Performance Analysis

| Bottleneck | Impact | Fix Applied |
|------------|--------|-------------|
| `select('*')` | DB I/O, bandwidth | Explicit columns (top endpoints) |
| Per-request Redis client | Connection exhaustion | Singleton in Express rate limiter |
| RAG embedding per message | $$$ OpenAI cost | 1h embedding cache by tenant+hash |
| Full message history load | Latency, memory | Pagination 50/page |
| N+1 inbox preview | DB round-trips | Batch query (existing) |
| Baileys in Next | OOM risk | Documented — dedicated container |
| Heavy dashboard bundles | LCP | Code-split (future) |

**Estimates (moderate load):**
- DB CPU: 40–60% without indexes on hot paths; inbox index helps
- P99 API latency: 200–800ms with RAG; 50–150ms without
- Cold start: Next ~2–4s; Express ~1–2s on Fly.io

---

### 5. Database Review

#### Strengths

- `tenant_id` on all tenant tables
- RLS policies enforced for anon/authenticated roles
- `match_kb` RPC for pgvector RAG (tenant parameter)
- Partitioning / pg_cron in migrations (where applied)
- Inbox pagination indexes

#### Concerns

| Concern | Recommendation |
|---------|----------------|
| `organization_id` vs `tenant_id` | Deprecate `organization_id`; migration script |
| Service role in workers | Always `.eq('tenant_id', ...)` — audit quarterly |
| Migration CI | Add ephemeral Supabase branch apply |
| No DR docs | Document RPO 24h / RTO 4h with Supabase backups |

#### Recommended Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage
  ON leads (tenant_id, stage);
```

---

### 6. DevOps & Infrastructure

| Component | Current State |
|-----------|---------------|
| Docker Compose | Local dev (note: `replicas: 2` invalid in Compose v3 — use Swarm or duplicate services) |
| CI | lint, tsc, **vitest**, npm audit (blocking high), TruffleHog, migrations check, GHCR build, Fly deploy |
| Monitoring | Pino, Sentry, Prometheus metrics endpoint |
| Secrets | Env vars — centralize in Fly/Vercel secrets |

#### Risks Addressed / Remaining

| Risk | Status |
|------|--------|
| Vitest not in CI | **Fixed** |
| npm audit non-blocking | **Fixed** |
| No fly.toml in repo | Open |
| Frontend Docker not in CI | Open (API image only) |
| eslint.ignoreDuringBuilds | `false` |
| Bull Board exposed | Ops — restrict by network |

---

### 7. Testing Analysis

| Category | Count | Location |
|----------|-------|----------|
| Unit (Vitest) | 8 files | `tests/*.test.ts` |
| Integration scripts | 3 | `server/scripts/validate/` |
| E2E | 0 | — |

**Coverage gaps:** Paddle webhooks, 2FA, uploads E2E, Socket.IO, Baileys worker, 40+ Next API routes.

**Suggested structure:**

```
tests/
  unit/
  api/
  integration/
e2e/playwright/
```

**Tests added this release:**
- `security-critical.test.ts` — diagnostic, internal key, verify token, uploads
- `rate-limit.test.ts` — fail-closed production behavior

---

### 8. AI / LLM System Review

#### Pipeline (`AIGateway.generateResponse`)

1. Regex prompt injection check
2. Upstash rate limit (per tenant:user)
3. RAG: embed → `match_kb` RPC (tenant-scoped, top 3 chunks)
4. Provider routing: Gemini → Mistral → Groq → OpenAI → OpenRouter
5. Output sanitization (PII redaction)

#### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Regex injection bypass | High | Add classifier model / Llama Guard |
| RAG poisoning | Medium | Sign KB docs; admin-only upload |
| Cost explosion | High | Per-tenant daily token budget (env exists, enforce in code) |
| Data leakage in logs | Medium | Redact message content in production logs |
| No token budget enforcement | Medium | Implement `AI_DAILY_TOKEN_BUDGET` counter in Redis |
| Hallucination | Low | Human handoff on low confidence (future) |

---

## PART 2: QA RELEASE REPORT

See `QA_DEPLOYMENT.md` for full checklist, smoke tests, and sign-off table.

### Fix Summary Table

| # | Severity | Issue | Files Changed | Status |
|---|----------|-------|---------------|--------|
| 1 | Critical | Diagnostic data leak | `app/api/diagnostic/route.ts`, `messages/route.ts` | Fixed |
| 2 | Critical | Internal API unauthenticated | `middleware.ts`, `internal.routes.ts` | Fixed |
| 3 | Critical | Default verify token | `app/api/whatsapp/connect/route.ts` | Fixed |
| 4 | Critical | Insecure uploads | `app/api/conversations/upload/route.ts` | Fixed |
| 5 | High | tenant_id split-brain | `middleware.ts`, `messages/[id]/route.ts` | Fixed |
| 6 | High | Rate limit fail-open | `rate-limit.middleware.ts` | Fixed |
| 7 | High | CORS bypass | `server/src/index.ts` | Fixed |
| 8 | Medium | HMAC duplication | `lib/utils/webhook-hmac.ts` | Fixed |
| 9 | Medium | select('*') over-fetch | catalog, templates, api.controller, etc. | Fixed |
| 10 | Perf | Embedding cache | `services/ai-gateway.ts` | Fixed |
| 11 | Perf | Message pagination | `leads/[id]/conversation/route.ts` | Fixed |
| 12 | CI | Vitest in pipeline | `.github/workflows/ci-cd.yml` | Fixed |

---

## PART 3: CHANGE SUMMARY

| File | Issue | Fix | Lines (approx) |
|------|-------|-----|----------------|
| `services/ai-gateway.ts` | Embedding cost | 1h cache | +55 |
| `app/api/leads/[id]/conversation/route.ts` | Full history load | Pagination | +25 |
| `app/api/catalog/route.ts` | Over-fetch | Column list | +2 |
| `app/api/whatsapp-templates/route.ts` | Over-fetch | Column list | +2 |
| `app/api/conversations/messages/[id]/route.ts` | IDOR risk | tenant_members | +8 |
| `server/src/controllers/api.controller.ts` | Over-fetch | Column lists | +15 |
| `server/src/middleware/rate-limit.middleware.ts` | Connection leak | Singleton | (existing) |
| `middleware.ts` | Internal auth | x-internal-key | (existing) |
| `tests/rate-limit.test.ts` | No test | Fail-closed test | +95 |
| `components/dashboard/ConversationViewer.tsx` | Pagination API | Parse messages | +6 |
| `.env.example` | Missing vars | INTERNAL_API_KEY, Paddle | +12 |
| `.github/workflows/ci-cd.yml` | No unit tests | npm test job | +4 |
| `SECURITY.md` | — | New doc | — |
| `QA_DEPLOYMENT.md` | — | New doc | — |
| `CODE_QUALITY.md` | — | New doc | — |

---

*End of system analysis. For deployment approval, complete sign-off in `QA_DEPLOYMENT.md`.*
