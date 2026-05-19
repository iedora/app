import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

const protectedPrefixes = ['/dashboard', '/onboarding']

/**
 * Optimistic cookie-presence check (AGENTS.md hard rule #5). The real auth
 * gate runs in the DAL — this only avoids a wasted RSC render when the
 * caller obviously isn't signed in.
 *
 * When the menu session cookie is missing we redirect to `/sign-in` —
 * a dedicated client page that kicks off Better Auth's generic-oauth
 * dance:
 *   menu → genkan/authorize → (sign-in if needed at genkan) → menu
 *   callback → menu session cookie set → redirect to `next`.
 *
 * This is Better Auth's recommended Next.js pattern (see
 * better-auth.com/docs/integrations/next). Previous incarnation
 * redirected to `genkan.iedora.com/login?next=…` directly, which caused
 * ERR_TOO_MANY_REDIRECTS: signing in at genkan only sets a genkan-domain
 * cookie, so the bounce back to menu arrived without a menu session
 * cookie and the proxy looped. Cross-domain auth requires the full
 * OAuth handshake to be initiated from menu's own host — the only way
 * the local session cookie gets set on the menu domain.
 */
export default function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtected = protectedPrefixes.some((p) => path.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const sessionCookie = getSessionCookie(req)
  if (!sessionCookie) {
    const url = req.nextUrl.clone()
    url.pathname = '/sign-in'
    url.search = ''
    // Same-origin path. /sign-in's safeNextPath() rejects anything that
    // isn't a same-origin path before passing to Better Auth.
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
