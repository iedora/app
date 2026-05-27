'use server'

import { revalidatePath } from 'next/cache'
import { requireIedoraAdmin } from '../../guards'
import { betterAuthAdminUsersGateway } from './adapters/better-auth'
import { banUser as banUserUseCase } from './use-cases/ban-user'
import { unbanUser as unbanUserUseCase } from './use-cases/unban-user'
import { setUserRole as setUserRoleUseCase } from './use-cases/set-role'
import { impersonateUser as impersonateUserUseCase } from './use-cases/impersonate'
import {
  revokeUserSession as revokeUserSessionUseCase,
  revokeUserSessions as revokeUserSessionsUseCase,
} from './use-cases/revoke-sessions'
import type { CrossTenantRole } from './use-cases/set-role'

/**
 * Server actions for admin-users. Every action:
 *  1. Re-asserts the iedora-admin guard (defence-in-depth — the route
 *     already gates, but actions can be POSTed standalone).
 *  2. Builds the better-auth gateway adapter.
 *  3. Delegates to the use-case, which holds the policy.
 *  4. Revalidates the users list path so the table reflects the change.
 */

type ActionResult = { ok: true } | { ok: false; error: string }

export async function banUserAction(input: {
  userId: string
  reason?: string
  expiresInDays?: number
}): Promise<ActionResult> {
  const session = await requireIedoraAdmin()
  const gateway = betterAuthAdminUsersGateway()
  const result = await banUserUseCase(gateway, {
    userId: input.userId,
    reason: input.reason,
    expiresInDays: input.expiresInDays,
    callerUserId: session.user.id,
  })
  if (!result.ok) return { ok: false, error: result.error.code }
  revalidatePath('/core/admin/users')
  revalidatePath(`/core/admin/users/${input.userId}`)
  return { ok: true }
}

export async function unbanUserAction(input: {
  userId: string
}): Promise<ActionResult> {
  await requireIedoraAdmin()
  const gateway = betterAuthAdminUsersGateway()
  await unbanUserUseCase(gateway, { userId: input.userId })
  revalidatePath('/core/admin/users')
  revalidatePath(`/core/admin/users/${input.userId}`)
  return { ok: true }
}

export async function setUserRoleAction(input: {
  userId: string
  role: CrossTenantRole | null
}): Promise<ActionResult> {
  const session = await requireIedoraAdmin()
  const gateway = betterAuthAdminUsersGateway()
  const result = await setUserRoleUseCase(gateway, {
    userId: input.userId,
    role: input.role,
    callerUserId: session.user.id,
  })
  if (!result.ok) return { ok: false, error: result.error.code }
  revalidatePath('/core/admin/users')
  revalidatePath(`/core/admin/users/${input.userId}`)
  return { ok: true }
}

export async function revokeUserSessionAction(input: {
  userId: string
  sessionToken: string
}): Promise<ActionResult> {
  await requireIedoraAdmin()
  const gateway = betterAuthAdminUsersGateway()
  await revokeUserSessionUseCase(gateway, { sessionToken: input.sessionToken })
  revalidatePath(`/core/admin/users/${input.userId}`)
  revalidatePath('/core/admin/sessions')
  return { ok: true }
}

export async function revokeAllUserSessionsAction(input: {
  userId: string
}): Promise<ActionResult> {
  await requireIedoraAdmin()
  const gateway = betterAuthAdminUsersGateway()
  await revokeUserSessionsUseCase(gateway, { userId: input.userId })
  revalidatePath(`/core/admin/users/${input.userId}`)
  revalidatePath('/core/admin/sessions')
  return { ok: true }
}

export async function impersonateUserAction(input: {
  userId: string
}): Promise<ActionResult> {
  const session = await requireIedoraAdmin()
  const gateway = betterAuthAdminUsersGateway()
  const result = await impersonateUserUseCase(gateway, {
    userId: input.userId,
    callerUserId: session.user.id,
  })
  if (!result.ok) return { ok: false, error: result.error.code }
  return { ok: true }
}
