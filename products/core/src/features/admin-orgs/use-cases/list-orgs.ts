import type {
  AdminOrgsGateway,
  ListOrgsInput,
  ListOrgsResult,
} from '../ports'

export async function listOrgs(
  gateway: AdminOrgsGateway,
  input: ListOrgsInput,
): Promise<ListOrgsResult> {
  const page = Math.max(1, Math.floor(input.page))
  const pageSize = Math.max(1, Math.min(200, Math.floor(input.pageSize)))
  return gateway.listOrgs({ ...input, page, pageSize })
}
