import type { AdminOrgsGateway } from '../ports'

export async function removeMember(
  gateway: AdminOrgsGateway,
  input: { organizationId: string; memberIdOrEmail: string },
): Promise<void> {
  await gateway.removeMember(input)
}

export async function updateMemberRole(
  gateway: AdminOrgsGateway,
  input: { organizationId: string; memberId: string; role: string },
): Promise<void> {
  await gateway.updateMemberRole(input)
}

export async function cancelInvitation(
  gateway: AdminOrgsGateway,
  input: { invitationId: string },
): Promise<void> {
  await gateway.cancelInvitation(input)
}
