import { describe, it, expect } from 'vitest'
import { listUsers } from './list-users'
import { makeFakeGateway, makeUser } from '../testing/fake-gateway'

describe('listUsers', () => {
  const base = {
    page: 1,
    pageSize: 50,
    sortBy: 'createdAt' as const,
    sortDirection: 'desc' as const,
  }

  it('returns every user when no filter is supplied', async () => {
    const { gateway } = makeFakeGateway({
      users: [
        makeUser({ id: '1', email: 'a@iedora.com' }),
        makeUser({ id: '2', email: 'b@iedora.com' }),
      ],
    })
    const result = await listUsers(gateway, base)
    expect(result.total).toBe(2)
    expect(result.users).toHaveLength(2)
  })

  it('matches the query against both email and name', async () => {
    const { gateway } = makeFakeGateway({
      users: [
        makeUser({ id: '1', email: 'alice@iedora.com', name: 'Alice' }),
        makeUser({ id: '2', email: 'bob@iedora.com', name: 'Bob' }),
      ],
    })
    const byEmail = await listUsers(gateway, { ...base, q: 'alice' })
    expect(byEmail.users.map((u) => u.id)).toEqual(['1'])

    const byName = await listUsers(gateway, { ...base, q: 'Bob' })
    expect(byName.users.map((u) => u.id)).toEqual(['2'])
  })

  it('filters by ban state', async () => {
    const { gateway } = makeFakeGateway({
      users: [
        makeUser({ id: '1', banned: false }),
        makeUser({ id: '2', banned: true }),
      ],
    })
    const banned = await listUsers(gateway, { ...base, banned: true })
    expect(banned.users.map((u) => u.id)).toEqual(['2'])
  })

  it('filters by role', async () => {
    const { gateway } = makeFakeGateway({
      users: [
        makeUser({ id: '1', role: null }),
        makeUser({ id: '2', role: 'iedora-admin' }),
      ],
    })
    const admins = await listUsers(gateway, { ...base, role: 'iedora-admin' })
    expect(admins.users.map((u) => u.id)).toEqual(['2'])
  })

  it('clamps pageSize to [1, 200]', async () => {
    const { gateway } = makeFakeGateway()
    const r1 = await listUsers(gateway, { ...base, pageSize: 0 })
    expect(r1.pageSize).toBe(1)
    const r2 = await listUsers(gateway, { ...base, pageSize: 10_000 })
    expect(r2.pageSize).toBe(200)
  })

  it('paginates by 1-indexed page', async () => {
    const { gateway } = makeFakeGateway({
      users: Array.from({ length: 5 }, (_, i) =>
        makeUser({
          id: String(i + 1),
          email: `u${i}@iedora.com`,
          createdAt: new Date(2025, 0, i + 1),
        }),
      ),
    })
    const page2 = await listUsers(gateway, { ...base, page: 2, pageSize: 2 })
    expect(page2.page).toBe(2)
    expect(page2.users).toHaveLength(2)
    expect(page2.total).toBe(5)
  })
})
