import type { AdminUsersError, AdminUsersGateway } from '../ports'

/**
 * Allow-list of cross-tenant roles. `null` (or empty string) demotes
 * the user back to a regular tenant member with no cross-tenant
 * privileges.
 */
export const ALLOWED_CROSS_TENANT_ROLES = ['iedora-admin'] as const
export type CrossTenantRole = (typeof ALLOWED_CROSS_TENANT_ROLES)[number]

export type SetRoleInput = {
  userId: string
  /** `null` clears the role. */
  role: CrossTenantRole | null
  callerUserId: string
}

export async function setUserRole(
  gateway: AdminUsersGateway,
  input: SetRoleInput,
): Promise<{ ok: true } | { ok: false; error: AdminUsersError }> {
  if (input.userId === input.callerUserId) {
    return { ok: false, error: { code: 'self-target' } }
  }
  await gateway.setRole({ userId: input.userId, role: input.role })
  return { ok: true }
}
