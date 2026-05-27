import type { AdminUsersGateway } from '../ports'

export async function unbanUser(
  gateway: AdminUsersGateway,
  input: { userId: string },
): Promise<void> {
  await gateway.unbanUser({ userId: input.userId })
}
