import 'server-only'
import { redirect } from 'next/navigation'
import type { AuthGateway } from '../ports'

/**
 * Step-up DAL guard for destructive operations.
 *
 * Contract:
 *   - no session                            → redirect to /login?return_to=...
 *   - signed in but `lastPasswordAt` older
 *     than `maxAgeMin` minutes              → redirect to /reauth?return_to=...
 *   - otherwise                             → returns the session
 *
 * Apply this at the top of any server action that destroys state
 * (user/org/app delete, role-to-admin promotion, ban, impersonate, edit
 * actions that reveal/change secrets). Non-destructive reads do NOT need
 * it — the standard `verifySession`/`requireAdmin` checks are enough.
 *
 * The redirect is thrown (Next-style) so callers don't need to handle a
 * result — control flow stops here when freshness is insufficient.
 *
 * `returnTo` defaults to '/admin' when omitted; pass the current URL when
 * you can so the user lands back where they came from after re-auth.
 */
export async function requireFreshSession(
  auth: AuthGateway,
  options?: { maxAgeMin?: number; returnTo?: string },
) {
  const maxAgeMin = options?.maxAgeMin ?? 5
  const returnTo = options?.returnTo ?? '/admin'

  const session = await auth.getSession()
  if (!session?.user) {
    redirect(`/login?return_to=${encodeURIComponent(returnTo)}`)
  }

  // `lastPasswordAt` is carried through `session.additionalFields` in the
  // Better Auth config — see better-auth-instance.ts. Treat a missing value
  // as "infinitely old": forces re-auth, which is the safer default during
  // any migration window before the column is populated.
  const rawLastPassword = (
    session.session as { lastPasswordAt?: Date | string | null }
  ).lastPasswordAt
  const lastPasswordAt =
    rawLastPassword == null
      ? null
      : rawLastPassword instanceof Date
        ? rawLastPassword
        : new Date(rawLastPassword)

  const cutoffMs = Date.now() - maxAgeMin * 60 * 1000
  const isFresh =
    lastPasswordAt !== null && lastPasswordAt.getTime() >= cutoffMs

  if (!isFresh) {
    redirect(`/reauth?return_to=${encodeURIComponent(returnTo)}`)
  }

  return session
}
