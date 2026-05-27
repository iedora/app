import type {
  AdminUsersGateway,
  ListUsersInput,
  ListUsersResult,
} from '../ports'

/**
 * Lists users with combined search + filters + paging.
 *
 * The query box is "contains anywhere in email or name"; the gateway
 * unions those fields server-side (better-auth's `searchField` is a
 * single column, so the union lives in the adapter).
 */
export async function listUsers(
  gateway: AdminUsersGateway,
  input: ListUsersInput,
): Promise<ListUsersResult> {
  const page = Math.max(1, Math.floor(input.page))
  const pageSize = Math.max(1, Math.min(200, Math.floor(input.pageSize)))
  return gateway.listUsers({ ...input, page, pageSize })
}
