# syntax=docker/dockerfile:1.7
# Multi-stage build for the menu app inside the Bun workspaces monorepo.
#
# Build context is the REPO ROOT (set via deploy.yml's `builder.context:
# ../../..`). Bun installs the workspace deps; Node executes the build
# (Bun + next build is unstable per AGENTS.md); final image runs server.js
# on Node over Next's standalone output.

# ── Stage 1: dependencies ─────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS deps
WORKDIR /workspace

# Workspace root manifest + lock.
COPY package.json bun.lock ./
# Every workspace package referenced from menu's package.json must be
# present so `bun install` can resolve `"@iedora/design-system": "workspace:*"`.
COPY packages packages
COPY products/menu/package.json products/menu/package.json
# Empty stubs so the workspace globs still match (no need to ship genkan/
# house source into menu's image).
RUN mkdir -p products/genkan products/house
COPY products/genkan/package.json products/genkan/package.json
COPY products/house/package.json products/house/package.json

RUN bun install --frozen-lockfile --ignore-scripts

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /workspace
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/products/menu/node_modules ./products/menu/node_modules
COPY --from=deps /workspace/package.json /workspace/bun.lock ./
COPY packages packages
COPY products/menu products/menu

WORKDIR /workspace/products/menu

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# SKIP_ENV_VALIDATION=1 returns a build-time stub Proxy from src/shared/env.ts
# so Next can collect page data without real env. Runtime env comes via Kamal.
ENV SKIP_ENV_VALIDATION=1

# Better Auth reads process.env at module load — placeholders so build is quiet.
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

# Next standalone in a monorepo lays out under products/menu/. The traced
# node_modules sit at the workspace root inside standalone. server.js is at
# products/menu/server.js — we WORKDIR into it for the CMD.
COPY --from=builder --chown=nextjs:nextjs /workspace/products/menu/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /workspace/products/menu/.next/static ./products/menu/.next/static
COPY --from=builder --chown=nextjs:nextjs /workspace/products/menu/public ./products/menu/public

USER nextjs
EXPOSE 3000
WORKDIR /app/products/menu

CMD ["node", "server.js"]
