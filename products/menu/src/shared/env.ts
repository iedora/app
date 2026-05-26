/**
 * Centralized, Zod-validated runtime environment.
 *
 * Two operating modes:
 *  - Build (`SKIP_ENV_VALIDATION=1`): returns a stub Proxy so `next build`'s
 *    "collect page data" phase can evaluate server modules (lib/db, auth,
 *    storage) without real secrets. Tofu wires the real env at runtime
 *    (Stage 4 `dockerOnHetzner` runtime — `infra/deploy/cmd/iedora/runtime_docker.go`).
 *  - Runtime: parses `process.env` with Zod and crashes loud, naming the
 *    offending keys — no buried postgres-js stack traces.
 *
 * Add a new env var by extending `serverSchema` below and (if appropriate)
 * `.env.example`. Optional vars use `.optional()`; defaults use `.default(…)`.
 */
import { z } from 'zod'

const serverSchema = z.object({
  // Node ----------------------------------------------------------------
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database ------------------------------------------------------------
  DATABASE_URL: z.url(),

  // Auth (@iedora/auth — better-auth) -----------------------------------
  // Postgres URL pointing at the `core` database (better-auth tables).
  // Same Postgres instance as DATABASE_URL — different DB.
  CORE_DATABASE_URL: z.url(),
  // ≥ 32-char secret used by better-auth to sign session tokens.
  IEDORA_AUTH_SECRET: z.string().min(32),
  // Canonical URL of the auth API. Today: menu's own origin
  // (`MENU_PUBLIC_URL`); when the `core` product lands this becomes
  // `https://core.iedora.com` and menu just consumes the cookie.
  IEDORA_AUTH_BASE_URL: z.url(),
  // Comma-separated allow-list for CSRF (browser-origin checks).
  IEDORA_AUTH_TRUSTED_ORIGINS: z.string().default(''),
  // Parent-domain cookie scope. Production: `.iedora.com` (default).
  // Dev: `localhost`. Empty string falls back to better-auth's default.
  IEDORA_AUTH_COOKIE_DOMAIN: z.string().default('.iedora.com'),

  // Menu's public base URL — used for absolute URL construction via
  // `publicUrl()`. Must match the canonical hostname the menu serves
  // (`https://menu.iedora.com` in prod, `http://localhost:3000` in dev).
  MENU_PUBLIC_URL: z.url(),

  // Rate-limit kill-switch. Set 'true' in e2e tests so the slice short-circuits
  // to "always ok" and load-bearing flows (org creation, asset upload) can
  // run in tight loops. Never enable in production.
  DISABLE_RATE_LIMIT: z.enum(['true', 'false']).optional(),

  // Object storage (S3 / MinIO / LocalStack / R2) -----------------------
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  // Optional CDN override. When unset, features/upload derives a path-style
  // URL from S3_ENDPOINT + S3_BUCKET (MinIO/LocalStack default).
  S3_PUBLIC_URL: z.url().optional(),
})

type ServerEnv = z.infer<typeof serverSchema>

const SKIP =
  process.env.SKIP_ENV_VALIDATION === '1' ||
  process.env.SKIP_ENV_VALIDATION === 'true'

function parseEnv(): ServerEnv {
  if (SKIP) {
    // Build-time stub. Any read returns an empty string except NODE_ENV,
    // which is consulted by lib/db to decide whether to cache the
    // connection on globalThis. We pin it to 'production' during builds.
    return new Proxy({} as ServerEnv, {
      get(_target, key) {
        if (key === 'NODE_ENV') return 'production'
        return ''
      },
    })
  }

  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('Invalid environment variables:')
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    }
    throw new Error('Environment validation failed')
  }
  return parsed.data
}

export const env: ServerEnv = parseEnv()
