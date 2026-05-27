import 'server-only'
import { headers as nextHeaders } from 'next/headers'
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { auth, getCoreDb, schema } from '@iedora/auth'
import type {
  AdminOrg,
  AdminOrgInvitation,
  AdminOrgMember,
  AdminOrgsGateway,
  FullOrg,
  ListOrgsInput,
  ListOrgsResult,
} from '../ports'

/**
 * The only file that names `getCoreDb()` / `auth.api.*` for the orgs
 * slice. Reads run against Drizzle (cross-tenant scope is the whole
 * point of the admin surface); writes funnel through better-auth's
 * organization plugin so lifecycle hooks + audit events still fire.
 */
export function drizzleAdminOrgsGateway(): AdminOrgsGateway {
  const db = getCoreDb()
  const h = async () => await nextHeaders()

  return {
    async listOrgs(input: ListOrgsInput): Promise<ListOrgsResult> {
      const where = input.q
        ? or(
            ilike(schema.organization.name, `%${input.q}%`),
            ilike(schema.organization.slug, `%${input.q}%`),
          )
        : undefined

      const order =
        input.sortBy === 'name'
          ? input.sortDirection === 'asc'
            ? asc(schema.organization.name)
            : desc(schema.organization.name)
          : input.sortDirection === 'asc'
            ? asc(schema.organization.createdAt)
            : desc(schema.organization.createdAt)

      const offset = (input.page - 1) * input.pageSize

      // One round-trip with a LEFT JOIN + GROUP BY so the member
      // counter doesn't require N+1 follow-ups. `total` runs as a
      // small second query — Postgres' planner handles it in ms.
      const rows = await db
        .select({
          id: schema.organization.id,
          name: schema.organization.name,
          slug: schema.organization.slug,
          logo: schema.organization.logo,
          createdAt: schema.organization.createdAt,
          metadata: schema.organization.metadata,
          memberCount: sql<number>`count(${schema.member.id})::int`.as(
            'member_count',
          ),
        })
        .from(schema.organization)
        .leftJoin(
          schema.member,
          eq(schema.member.organizationId, schema.organization.id),
        )
        .where(where)
        .groupBy(schema.organization.id)
        .orderBy(order)
        .limit(input.pageSize)
        .offset(offset)

      const result = await db
        .select({ value: sql<number>`count(*)::int`.as('count') })
        .from(schema.organization)
        .where(where)
      const total = result[0]?.value ?? 0

      return {
        orgs: rows.map<AdminOrg>((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug ?? null,
          logo: r.logo ?? null,
          createdAt: r.createdAt,
          metadata: parseMetadata(r.metadata),
          memberCount: r.memberCount ?? 0,
        })),
        total: total ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      }
    },

    async getFullOrg({ orgId }): Promise<FullOrg | null> {
      const [orgRow] = await db
        .select()
        .from(schema.organization)
        .where(eq(schema.organization.id, orgId))
        .limit(1)
      if (!orgRow) return null

      const memberRows = await db
        .select({
          id: schema.member.id,
          userId: schema.member.userId,
          role: schema.member.role,
          createdAt: schema.member.createdAt,
          userEmail: schema.user.email,
          userName: schema.user.name,
        })
        .from(schema.member)
        .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
        .where(eq(schema.member.organizationId, orgId))
        .orderBy(asc(schema.member.createdAt))

      const invitationRows = await db
        .select({
          id: schema.invitation.id,
          email: schema.invitation.email,
          role: schema.invitation.role,
          status: schema.invitation.status,
          expiresAt: schema.invitation.expiresAt,
          inviterId: schema.invitation.inviterId,
          inviterEmail: schema.user.email,
        })
        .from(schema.invitation)
        .leftJoin(
          schema.user,
          eq(schema.user.id, schema.invitation.inviterId),
        )
        .where(
          and(
            eq(schema.invitation.organizationId, orgId),
            eq(schema.invitation.status, 'pending'),
          ),
        )
        .orderBy(asc(schema.invitation.expiresAt))

      // Member count for the AdminOrg envelope — saves the consumer
      // from re-counting.
      const memberCount = memberRows.length

      return {
        org: {
          id: orgRow.id,
          name: orgRow.name,
          slug: orgRow.slug ?? null,
          logo: orgRow.logo ?? null,
          createdAt: orgRow.createdAt,
          metadata: parseMetadata(orgRow.metadata),
          memberCount,
        },
        members: memberRows.map<AdminOrgMember>((m) => ({
          id: m.id,
          userId: m.userId,
          userEmail: m.userEmail,
          userName: m.userName,
          role: m.role,
          createdAt: m.createdAt,
        })),
        invitations: invitationRows.map<AdminOrgInvitation>((i) => ({
          id: i.id,
          email: i.email,
          role: i.role ?? null,
          status: i.status,
          expiresAt: i.expiresAt,
          inviterId: i.inviterId,
          inviterEmail: i.inviterEmail ?? null,
        })),
      }
    },

    async removeMember({ organizationId, memberIdOrEmail }) {
      await auth.api.removeMember({
        body: { organizationId, memberIdOrEmail },
        headers: await h(),
      })
    },

    async updateMemberRole({ organizationId, memberId, role }) {
      await auth.api.updateMemberRole({
        body: { organizationId, memberId, role: role as never },
        headers: await h(),
      })
    },

    async cancelInvitation({ invitationId }) {
      await auth.api.cancelInvitation({
        body: { invitationId },
        headers: await h(),
      })
    },
  }
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}
