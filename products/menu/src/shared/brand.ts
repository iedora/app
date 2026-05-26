/**
 * Single source of truth for brand + public URLs that appear in the UI.
 *
 * Static / safe in both server and client components (no `@/shared/env`
 * import) — for RUNTIME urls (CORS origin, auth callbacks) read
 * `env.MENU_PUBLIC_URL` from `@/shared/env` instead.
 *
 * To rebrand: change `BRAND_DOMAIN`. Everything else derives from it.
 */
export const BRAND_DOMAIN = 'iedora.com'

export const BRAND_NAME = 'iedora'
export const BRAND_URL = `https://${BRAND_DOMAIN}`
export const CONTACT_EMAIL = `hello@${BRAND_DOMAIN}`

// The Menu app lives on a `menu.` subdomain of the brand.
export const APP_HOSTNAME = `menu.${BRAND_DOMAIN}`
export const APP_URL = `https://${APP_HOSTNAME}`

// Sign-in / sign-out routes on the menu domain. Both are page routes —
// `/sign-in` and `/sign-out` — backed by better-auth: the page calls
// `authClient.signIn.email(...)` / `authClient.signOut()` which hits
// `/api/auth/*` under the hood (see `src/app/api/auth/[...all]`).
export const SIGN_IN_PATH = '/sign-in'
export const SIGN_OUT_PATH = '/sign-out'

/**
 * Helper for client + server callers: build a `/sign-in?next=…` URL the
 * proxy + DAL redirect into when no session is present. `next` MUST be a
 * same-origin path (the sign-in page re-validates).
 */
export function signInUrl(next?: string): string {
  if (!next) return SIGN_IN_PATH
  return `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`
}
