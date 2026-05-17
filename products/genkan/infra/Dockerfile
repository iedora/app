# syntax=docker/dockerfile:1.7
# Multi-stage build for genkan inside the Bun workspaces monorepo.
# Build context is the REPO ROOT (set via deploy.yml's `builder.context:
# ../../../..`). Same pattern as products/menu/infra/Dockerfile.

# ── Stage 1: dependencies ─────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS deps
WORKDIR /workspace

COPY package.json bun.lock ./
COPY packages packages
COPY products/genkan/package.json products/genkan/package.json
# Stubs so the workspace globs still resolve without shipping sibling source.
RUN mkdir -p products/menu products/house
COPY products/menu/package.json products/menu/package.json
COPY products/house/package.json products/house/package.json

RUN bun install --frozen-lockfile --ignore-scripts

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /workspace
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/products/genkan/node_modules ./products/genkan/node_modules
COPY --from=deps /workspace/package.json /workspace/bun.lock ./
COPY packages packages
COPY products/genkan products/genkan

WORKDIR /workspace/products/genkan

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=1
ENV BETTER_AUTH_SECRET=build-placeholder-overridden-at-runtime-32chars
ENV BETTER_AUTH_URL=http://build.local

RUN node --run build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nextjs && \
    adduser -S -u 1001 -G nextjs nextjs

# Next standalone in a monorepo lays out under products/genkan/.
COPY --from=builder --chown=nextjs:nextjs /workspace/products/genkan/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /workspace/products/genkan/.next/static ./products/genkan/.next/static
# Genkan has no public/ directory — auth pages render entirely from the
# design system. Skip the copy that menu's Dockerfile does.

USER nextjs
EXPOSE 3000
WORKDIR /app/products/genkan

CMD ["node", "server.js"]
