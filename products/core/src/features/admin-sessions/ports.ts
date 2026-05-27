/**
 * Admin sessions slice — every active session across every product.
 *
 * The list query is a fan-out: better-auth has no "list every session
 * for every user" endpoint, so we list users and `listUserSessions`
 * each. Page in batches and bound the join to the largest reasonable
 * tenant fleet — the surface degrades gracefully at scale because the
 * fan-out shape is async-parallel.
 */
export type AdminSessionRow = {
  id: string
  token: string
  userId: string
  userEmail: string
  userName: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
  expiresAt: Date
  impersonatedBy: string | null
}

export type ListAllSessionsInput = {
  /** Free-text search over user email / name. */
  q?: string
  /** Optional filter — only show sessions opened by impersonation. */
  impersonatedOnly?: boolean
  /** Soft cap on the user fan-out (defaults to 500). */
  userLimit?: number
}

export interface AdminSessionsGateway {
  listAllSessions(input: ListAllSessionsInput): Promise<ReadonlyArray<AdminSessionRow>>
  revokeSession(input: { sessionToken: string }): Promise<void>
}
