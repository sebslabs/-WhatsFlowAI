# ────────────────────────────────────────────────────────────────
# WhatsFlow AI — Production Dockerfile
# Multi-stage build for minimal image size
# ────────────────────────────────────────────────────────────────

# ── Stage 1: Dependencies ─────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: Build ────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# ── Stage 3: Runtime ──────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 whatsflow

# Copy only what's needed at runtime
COPY --from=deps     --chown=whatsflow:nodejs /app/node_modules ./node_modules
COPY --from=builder  --chown=whatsflow:nodejs /app/dist        ./dist
COPY --chown=whatsflow:nodejs package.json ./

USER whatsflow

ENV NODE_ENV=production

EXPOSE 5000

# Health check — waits 15s for startup validator to complete
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "dist/index.js"]
