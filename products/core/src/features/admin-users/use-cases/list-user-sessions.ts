import type { AdminUserSession, AdminUsersGateway } from '../ports'

export async function listUserSessions(
  gateway: AdminUsersGateway,
  input: { userId: string },
): Promise<ReadonlyArray<AdminUserSession>> {
  const sessions = await gateway.listUserSessions({ userId: input.userId })
  // Newest first so the UI shows the most recently issued session at
  // the top — useful when picking which to revoke.
  return [...sessions].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )
}
