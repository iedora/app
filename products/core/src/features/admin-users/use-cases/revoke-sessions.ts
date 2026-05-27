import type { AdminUsersGateway } from '../ports'

export async function revokeUserSessions(
  gateway: AdminUsersGateway,
  input: { userId: string },
): Promise<void> {
  await gateway.revokeUserSessions({ userId: input.userId })
}

export async function revokeUserSession(
  gateway: AdminUsersGateway,
  input: { sessionToken: string },
): Promise<void> {
  await gateway.revokeUserSession({ sessionToken: input.sessionToken })
}
