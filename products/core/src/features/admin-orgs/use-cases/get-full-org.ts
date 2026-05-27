import type { AdminOrgsGateway, FullOrg } from '../ports'

export async function getFullOrg(
  gateway: AdminOrgsGateway,
  input: { orgId: string },
): Promise<FullOrg | null> {
  return gateway.getFullOrg({ orgId: input.orgId })
}
