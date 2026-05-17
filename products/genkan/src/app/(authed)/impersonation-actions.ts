'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/features/auth/adapters/better-auth-instance'
import { recordAdminEvent } from '../admin/_lib/audit'

type Result = { ok: false; error: string }

function toMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object') {
    const obj = e as { message?: unknown; body?: { message?: unknown } }
    if (typeof obj.message === 'string') return obj.message
    if (obj.body && typeof obj.body.message === 'string') return obj.body.message
  }
  return fallback
}

/**
 * Server action mate of `impersonateAction`. Lives outside /admin because
 * the caller is the impersonated user, who isn't an admin while the
 * impersonation is active.
 *
 * Order matters: capture the admin id BEFORE calling stopImpersonating —
 * once that endpoint flips the cookie back, the audit row's actor needs to
 * be the admin, not the impersonated user. Recording AFTER the flip keeps
 * the request-context headers (IP, UA) consistent with the admin's
 * resumed session.
 */
export async function stopImpersonatingAction(): Promise<Result | void> {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  if (!session?.user) {
    return { ok: false, error: 'Not signed in.' }
  }
  const adminId = session.session.impersonatedBy
  const impersonatedId = session.user.id
  if (!adminId) {
    return { ok: false, error: 'You are not impersonating anyone.' }
  }

  try {
    await auth.api.stopImpersonating({ headers: reqHeaders })
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Could not stop impersonating.') }
  }

  const audit = await recordAdminEvent(
    { action: 'user.impersonate_stop', targetId: impersonatedId },
    { id: adminId, role: 'admin' },
  )
  if (!audit.ok) return audit
  redirect('/admin/users')
}
