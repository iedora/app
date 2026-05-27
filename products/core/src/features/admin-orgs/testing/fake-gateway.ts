import type {
  AdminOrg,
  AdminOrgInvitation,
  AdminOrgMember,
  AdminOrgsGateway,
  FullOrg,
  ListOrgsInput,
  ListOrgsResult,
} from '../ports'

type State = {
  orgs: AdminOrg[]
  members: Record<string, AdminOrgMember[]>
  invitations: Record<string, AdminOrgInvitation[]>
  calls: {
    removeMember: Array<{ organizationId: string; memberIdOrEmail: string }>
    updateMemberRole: Array<{
      organizationId: string
      memberId: string
      role: string
    }>
    cancelInvitation: Array<{ invitationId: string }>
  }
}

export function makeFakeOrgsGateway(seed: {
  orgs?: AdminOrg[]
  members?: Record<string, AdminOrgMember[]>
  invitations?: Record<string, AdminOrgInvitation[]>
} = {}): { gateway: AdminOrgsGateway; state: State } {
  const state: State = {
    orgs: seed.orgs ? [...seed.orgs] : [],
    members: { ...(seed.members ?? {}) },
    invitations: { ...(seed.invitations ?? {}) },
    calls: { removeMember: [], updateMemberRole: [], cancelInvitation: [] },
  }

  const gateway: AdminOrgsGateway = {
    async listOrgs(input: ListOrgsInput): Promise<ListOrgsResult> {
      let orgs = state.orgs
      if (input.q) {
        const needle = input.q.toLowerCase()
        orgs = orgs.filter(
          (o) =>
            o.name.toLowerCase().includes(needle) ||
            (o.slug ?? '').toLowerCase().includes(needle),
        )
      }
      const sorted = [...orgs].sort((a, b) => {
        const dir = input.sortDirection === 'asc' ? 1 : -1
        if (input.sortBy === 'name') return a.name.localeCompare(b.name) * dir
        return (a.createdAt.getTime() - b.createdAt.getTime()) * dir
      })
      const total = sorted.length
      const offset = (input.page - 1) * input.pageSize
      return {
        orgs: sorted.slice(offset, offset + input.pageSize),
        total,
        page: input.page,
        pageSize: input.pageSize,
      }
    },

    async getFullOrg({ orgId }): Promise<FullOrg | null> {
      const org = state.orgs.find((o) => o.id === orgId)
      if (!org) return null
      return {
        org,
        members: state.members[orgId] ?? [],
        invitations: state.invitations[orgId] ?? [],
      }
    },

    async removeMember(input) {
      state.calls.removeMember.push(input)
      const list = state.members[input.organizationId] ?? []
      state.members[input.organizationId] = list.filter(
        (m) =>
          m.id !== input.memberIdOrEmail &&
          m.userEmail !== input.memberIdOrEmail,
      )
    },

    async updateMemberRole(input) {
      state.calls.updateMemberRole.push(input)
      const list = state.members[input.organizationId] ?? []
      state.members[input.organizationId] = list.map((m) =>
        m.id === input.memberId ? { ...m, role: input.role } : m,
      )
    },

    async cancelInvitation(input) {
      state.calls.cancelInvitation.push(input)
      for (const orgId of Object.keys(state.invitations)) {
        state.invitations[orgId] = (state.invitations[orgId] ?? []).filter(
          (i) => i.id !== input.invitationId,
        )
      }
    },
  }

  return { gateway, state }
}

export function makeOrg(over: Partial<AdminOrg> = {}): AdminOrg {
  return {
    id: over.id ?? `o_${Math.random().toString(36).slice(2, 10)}`,
    name: over.name ?? 'Org',
    slug: over.slug ?? null,
    logo: over.logo ?? null,
    createdAt: over.createdAt ?? new Date('2025-01-01T00:00:00Z'),
    metadata: over.metadata ?? null,
    memberCount: over.memberCount ?? 0,
  }
}

export function makeMember(over: Partial<AdminOrgMember> = {}): AdminOrgMember {
  return {
    id: over.id ?? `m_${Math.random().toString(36).slice(2, 10)}`,
    userId: over.userId ?? 'u_test',
    userEmail: over.userEmail ?? 'user@iedora.com',
    userName: over.userName ?? 'User',
    role: over.role ?? 'member',
    createdAt: over.createdAt ?? new Date('2025-01-01T00:00:00Z'),
  }
}
