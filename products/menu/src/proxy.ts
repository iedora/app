import { NextRequest, NextResponse } from 'next/server'
import { publicUrl } from '@/shared/url'
import { signInUrl } from '@/shared/brand'

const protectedPrefixes = ['/dashboard', '/onboarding']

/**
 * Hosts served by the iedora.com brand page (instead of menu's app).
 * The CF Tunnel routes both `iedora.com` and `www.iedora.com` to the
 * same upstream; the proxy decides what to render based on Host.
 */
const houseHosts = new Set(['iedora.com', 'www.iedora.com'])

/**
 * better-auth's session cookie name. Used here only as an OPTIMISTIC
 * hint (cookie present ⇒ likely signed in) — the real session lookup
 * happens in the DAL via `auth.api.getSession()`. AGENTS.md hard rule #5.
 *
 * Default name in better-auth is `better-auth.session_token` (with the
 * cross-subdomain config we set, it stays this shape — only the cookie
 * `Domain` attribute changes).
 */
const SESSION_COOKIE = 'better-auth.session_token'

/**
 * Two jobs in order of precedence:
 *
 *   1. **Host-based rewrite.** When the request's Host is one of
 *      `houseHosts`, rewrite the pathname to `/house/<original>`. The
 *      `/house` segment is the internal namespace inside this app for
 *      everything iedora.com serves. Direct visits to
 *      `menu.iedora.com/house*` 404 (see the guard below).
 *
 *   2. **Optimistic auth gate** for menu's protected prefixes. Real
 *      auth runs in the DAL via `verifySession()`. The redirect goes
 *      through `publicUrl()` because Cloudflare Tunnel fronts Next in
 *      prod — `req.nextUrl` carries the internal bind `http://0.0.0.0:3000`
 *      which the browser can't follow.
 */
export default function proxy(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0] ?? ''
  const path = req.nextUrl.pathname

  // 1. House host → rewrite under /house.
  if (houseHosts.has(host)) {
    const target = path === '/' ? '/house' : `/house${path}`
    const url = req.nextUrl.clone()
    url.pathname = target
    return NextResponse.rewrite(url)
  }

  // Direct visits to /house* from menu.iedora.com don't make sense —
  // the namespace is reserved for iedora.com. 404 to keep the URL
  // surface honest.
  if (path === '/house' || path.startsWith('/house/')) {
    return new NextResponse('Not Found', { status: 404 })
  }

  // 2. Menu's optimistic auth check.
  const isProtected = protectedPrefixes.some((p) => path.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const hasSession = req.cookies.has(SESSION_COOKIE)
  if (!hasSession) {
    return NextResponse.redirect(publicUrl(signInUrl(path)))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
