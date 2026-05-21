# WhatsFlow AI — QA Deployment Guide

Production release checklist for stakeholders (DevOps, Backend, QA, Security).

## Executive Summary

| Metric | Status |
|--------|--------|
| Critical issues fixed | 4/4 |
| High issues fixed | 5/6 |
| Test coverage added | 8 Vitest files (security, auth, RBAC, webhooks, rate limit) |
| Production readiness | **Conditional GO** — pending Baileys worker isolation |
| Rollback risk | **Low** — backward-compatible API except paginated conversation response |

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client-side Supabase (RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server) | Bypass RLS for workers only |
| `ENCRYPTION_KEY` | Yes | AES-256-GCM for WhatsApp tokens (64 hex) |
| `INTERNAL_API_KEY` | Yes (prod) | M2M auth for `/api/internal/*` |
| `WHATSAPP_VERIFY_TOKEN` | Yes (prod) | Meta webhook verification |
| `META_APP_SECRET` | Yes | Webhook HMAC validation |
| `UPSTASH_REDIS_REST_URL` | Yes (prod) | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Yes (prod) | Rate limiting |
| `REDIS_URL` | Yes | BullMQ job queues |
| `ALLOWED_ORIGIN` | Yes (prod) | CORS allowlist (comma-separated) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Worker callbacks to Next.js |
| `OPENAI_API_KEY` | Recommended | RAG embeddings + GPT |
| `PADDLE_API_KEY` | If billing | Subscription webhooks |
| `PADDLE_WEBHOOK_SECRET` | If billing | Paddle signature verification |
| `SENTRY_DSN` | Recommended | Error tracking |

Copy from `.env.example` → `.env.local` (frontend) and `server/.env` (backend).

## Storage Migration

1. Supabase Dashboard → Storage → `chat-attachments`
2. Set bucket to **Private**
3. Remove any public policies on `chat-attachments`
4. Verify uploads return signed URLs (1h expiry)

## Automated Tests

```bash
# Frontend unit + security tests
npm test

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Server build
cd server && npm run build
```

## Manual Smoke Tests

### Auth guard

```bash
curl -s https://YOUR_APP/api/leads -w "\nHTTP %{http_code}\n"
# Expected: HTTP 401
```

### Diagnostic 404

```bash
curl -s https://YOUR_APP/api/diagnostic -w "\nHTTP %{http_code}\n"
# Expected: HTTP 404 (production)
```

### Webhook HMAC (invalid signature)

```bash
curl -s -X POST https://YOUR_APP/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=deadbeef" \
  -d '{}' -w "\nHTTP %{http_code}\n"
# Expected: HTTP 401 or 403
```

### Health check

```bash
curl -s https://YOUR_API_HOST/health
# Expected: {"status":"ok",...}
```

## Rollback Notes

| Change | Breaking? | Mitigation |
|--------|-----------|------------|
| Conversation API pagination | **Yes** (response shape) | Frontend updated; old clients must read `data.messages` |
| Upload signed URLs | No | Old public URLs expire naturally |
| Internal API key required | Yes for M2M | Set `INTERNAL_API_KEY` before deploy |

**Rollback procedure:** Revert to previous Docker image tag on Fly.io; restore env vars from secrets manager snapshot.

## Post-Deployment Verification

| Window | Owner | Check |
|--------|-------|-------|
| 1h | DevOps | `/health` 200, error rate < 1%, Redis connected |
| 1h | Backend | Webhook processing, queue depth stable |
| 4h | QA | Login, inbox load, send message, AI reply |
| 4h | Security | No 200 on `/api/diagnostic`, internal routes reject bad keys |
| 24h | DevOps | Sentry error trends, DB CPU < 70% |

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Engineering Lead | | | Pending |
| DevOps | | | Pending |
| QA Lead | | | Pending |
| Security | | | Pending |
| Product | | | Pending |
