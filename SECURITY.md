# WhatsFlow AI — Security Posture & Fix Summary

Last updated: 2026-05-18

## Executive Summary

This document records critical and high-severity vulnerabilities identified in the WhatsFlow AI pre-production audit, their remediation status, and deployment verification steps.

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical   | 4 | 4 | 0 |
| High       | 6 | 5 | 1 (Baileys in Next process — architectural) |
| Medium     | 12 | 8 | 4 |
| Low        | 8 | 3 | 5 |

## Critical Fixes (Deployed)

### CRITICAL-1: Unauthenticated diagnostic endpoints

| Item | Detail |
|------|--------|
| **CVSS** | 9.1 (Critical) |
| **Files** | `app/api/diagnostic/route.ts`, `app/api/diagnostic/messages/route.ts` |
| **Attack** | Unauthenticated GET returned cross-tenant messages/contacts; `/messages` performed destructive UPDATE/DELETE |
| **Root cause** | Debug routes shipped without auth or tenant scoping |
| **Fix** | Production returns 404; dev requires `requireAdminApi` + `tenant_id` filter; `/messages` permanently 404 |

### CRITICAL-2: Unprotected internal API routes

| Item | Detail |
|------|--------|
| **CVSS** | 9.0 (Critical) |
| **Files** | `middleware.ts`, `server/src/routes/internal.routes.ts`, `app/api/internal/**` |
| **Attack** | Call `/api/internal/baileys/send` without auth to enqueue arbitrary messages |
| **Root cause** | Internal routes excluded from session auth without alternative secret |
| **Fix** | Mandatory `x-internal-key` validated at Next.js edge and Express router |

### CRITICAL-3: Hardcoded WhatsApp verify token default

| Item | Detail |
|------|--------|
| **CVSS** | 8.6 (High/Critical boundary) |
| **Files** | `app/api/whatsapp/connect/route.ts` |
| **Attack** | Attacker completes Meta webhook verification using known default token |
| **Root cause** | Fallback string `whatsflow_default_verify` when env unset |
| **Fix** | Production refuses connect if `WHATSAPP_VERIFY_TOKEN` / `META_VERIFY_TOKEN` absent; DB stores `null` not default |

### CRITICAL-4: Insecure file uploads

| Item | Detail |
|------|--------|
| **CVSS** | 8.1 (High) |
| **Files** | `app/api/conversations/upload/route.ts` |
| **Attack** | Upload SVG/executable to public bucket; XSS or malware distribution |
| **Root cause** | Public bucket, no MIME allowlist, public URLs |
| **Fix** | MIME allowlist, extension match, 20MB cap, private bucket, signed URLs, tenant-prefixed paths |

## High Fixes

| ID | Issue | Files | Fix |
|----|-------|-------|-----|
| HIGH-5 | `organization_id` vs `tenant_id` split-brain | `middleware.ts`, `app/api/conversations/messages/[id]/route.ts` | Canonical `tenant_members.tenant_id` |
| HIGH-6 | Rate limiter fail-open | `server/src/middleware/rate-limit.middleware.ts` | Redis singleton + 503 fail-closed in production |
| HIGH-7 | CORS origin-less bypass | `server/src/index.ts` | Require Origin in production |
| HIGH-8 | npm audit non-blocking | `.github/workflows/ci-cd.yml` | `--audit-level=high` blocks pipeline |

## Pre-Deployment Checklist

- [ ] Set `INTERNAL_API_KEY` (32+ byte secret) on Next.js and Express
- [ ] Set `WHATSAPP_VERIFY_TOKEN` / `META_VERIFY_TOKEN` in production
- [ ] Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (rate limiting)
- [ ] Set `ENCRYPTION_KEY` (64 hex chars) for token encryption at rest
- [ ] Migrate `chat-attachments` bucket to **private** in Supabase dashboard
- [ ] Rotate any credentials that may have been exposed via old diagnostic routes
- [ ] Confirm `NODE_ENV=production` on all production hosts
- [ ] Run `npx vitest run` — all security tests must pass
- [ ] Run `npm audit --audit-level=high` — zero high/critical CVEs

## Smoke Tests

```bash
# Diagnostic blocked in production
curl -s -o /dev/null -w "%{http_code}" https://YOUR_APP/api/diagnostic
# Expected: 404

# Internal route without key
curl -s -o /dev/null -w "%{http_code}" -X POST https://YOUR_APP/api/internal/baileys/send
# Expected: 401

# Internal route with key
curl -s -X POST https://YOUR_APP/api/internal/baileys/send \
  -H "x-internal-key: $INTERNAL_API_KEY" -H "Content-Type: application/json" \
  -d '{"tenantId":"test"}'
# Expected: 202 or 400 (not 401)
```

## Reporting Vulnerabilities

Email security issues to your team's security contact. Do not open public GitHub issues for undisclosed vulnerabilities.
