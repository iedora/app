import type { AdminUsersError, AdminUsersGateway } from '../ports'

export type ImpersonateInput = {
  userId: string
  callerUserId: string
}

/**
 * Start impersonating another user. After this resolves the caller's
 * session cookie is rewritten to the impersonated user's identity;
 * `session.impersonatedBy` carries the admin's id back so the chrome
 * can render a "you're impersonating X" banner and the audit trail
 * stays intact.
 */
export async function impersonateUser(
  gateway: AdminUsersGateway,
  input: ImpersonateInput,
): Promise<{ ok: true } | { ok: false; error: AdminUsersError }> {
  if (input.userId === input.callerUserId) {
    return { ok: false, error: { code: 'self-target' } }
  }
  await gateway.impersonateUser({ userId: input.userId })
  return { ok: true }
}
