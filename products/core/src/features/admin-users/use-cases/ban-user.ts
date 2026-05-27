import type { AdminUsersGateway, AdminUsersError } from '../ports'

export type BanUserInput = {
  /** The user to ban. */
  userId: string
  /** Optional human-readable reason (shown on the user's own sessions). */
  reason?: string
  /** Optional days from now before the ban auto-lifts. Omit for permanent. */
  expiresInDays?: number
  /** The caller — used to guard against self-bans. */
  callerUserId: string
}

export async function banUser(
  gateway: AdminUsersGateway,
  input: BanUserInput,
): Promise<{ ok: true } | { ok: false; error: AdminUsersError }> {
  if (input.userId === input.callerUserId) {
    return { ok: false, error: { code: 'self-target' } }
  }
  const reason = input.reason?.trim() || undefined
  const expiresInSec =
    typeof input.expiresInDays === 'number' && input.expiresInDays > 0
      ? Math.floor(input.expiresInDays * 24 * 60 * 60)
      : undefined
  await gateway.banUser({ userId: input.userId, reason, expiresInSec })
  return { ok: true }
}
