/**
 * Admin orgs slice ports.
 *
 * Reads go through Drizzle directly against the `core` schema —
 * better-auth's `auth.api.listOrganizations` only returns orgs the
 * caller belongs to, which is wrong for cross-tenant admin. Writes
 * funnel through `auth.api.*` so better-auth's lifecycle hooks
 * (cascade member removal, invitation TTL, etc.) still fire.
 */

export type AdminOrg = {
  id: string
  name: string
  slug: string | null
  logo: string | null
  createdAt: Date
  /** Parsed metadata blob; `null` when the row stored `null`/invalid JSON. */
  metadata: Record<string, unknown> | null
  /** Aggregated member count from the join — cheap to compute alongside list. */
  memberCount: number
}

export type AdminOrgMember = {
  id: string
  userId: string
  userEmail: string
  userName: string
  role: string
  createdAt: Date
}

export type AdminOrgInvitation = {
  id: string
  email: string
  role: string | null
  status: string
  expiresAt: Date
  inviterId: string
  inviterEmail: string | null
}

export type ListOrgsInput = {
  q?: string
  page: number
  pageSize: number
  sortBy: 'createdAt' | 'name'
  sortDirection: 'asc' | 'desc'
}

export type ListOrgsResult = {
  orgs: ReadonlyArray<AdminOrg>
  total: number
  page: number
  pageSize: number
}

export type FullOrg = {
  org: AdminOrg
  members: ReadonlyArray<AdminOrgMember>
  invitations: ReadonlyArray<AdminOrgInvitation>
}

export interface AdminOrgsGateway {
  listOrgs(input: ListOrgsInput): Promise<ListOrgsResult>
  getFullOrg(input: { orgId: string }): Promise<FullOrg | null>
  removeMember(input: {
    organizationId: string
    memberIdOrEmail: string
  }): Promise<void>
  updateMemberRole(input: {
    organizationId: string
    memberId: string
    role: string
  }): Promise<void>
  cancelInvitation(input: { invitationId: string }): Promise<void>
}
