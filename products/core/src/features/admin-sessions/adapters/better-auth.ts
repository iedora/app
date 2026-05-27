import 'server-only'
import { headers as nextHeaders } from 'next/headers'
import { auth } from '@iedora/auth'
import type {
  AdminSessionRow,
  AdminSessionsGateway,
  ListAllSessionsInput,
} from '../ports'

export function betterAuthAdminSessionsGateway(): AdminSessionsGateway {
  const h = async () => await nextHeaders()
  return {
    async listAllSessions(input: ListAllSessionsInput) {
      const limit = input.userLimit ?? 500
      const usersResponse = await auth.api.listUsers({
        query: { limit, sortBy: 'createdAt', sortDirection: 'desc' },
        headers: await h(),
      })

      const users = usersResponse.users ?? []
      const needle = input.q?.toLowerCase() ?? null
      const candidates = needle
        ? users.filter(
            (u) =>
              u.email.toLowerCase().includes(needle) ||
              u.name.toLowerCase().includes(needle),
          )
        : users

      const headers = await h()
      const lists = await Promise.all(
        candidates.map((u) =>
          auth.api
            .listUserSessions({ body: { userId: u.id }, headers })
            .then((r) => ({
              user: u,
              sessions: r.sessions ?? [],
            })),
        ),
      )

      const rows: AdminSessionRow[] = []
      for (const { user, sessions } of lists) {
        for (const s of sessions) {
          const impersonatedBy =
            (s as { impersonatedBy?: string | null }).impersonatedBy ?? null
          if (input.impersonatedOnly && !impersonatedBy) continue
          rows.push({
            id: s.id,
            token: s.token,
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
            ipAddress: s.ipAddress ?? null,
            userAgent: s.userAgent ?? null,
            createdAt: new Date(s.createdAt),
            expiresAt: new Date(s.expiresAt),
            impersonatedBy,
          })
        }
      }
      rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      return rows
    },

    async revokeSession({ sessionToken }) {
      await auth.api.revokeUserSession({
        body: { sessionToken },
        headers: await h(),
      })
    },
  }
}
