import { describe, it, expect } from 'vitest'
import { listOrgs } from './list-orgs'
import { makeFakeOrgsGateway, makeOrg } from '../testing/fake-gateway'

describe('listOrgs', () => {
  const base = {
    page: 1,
    pageSize: 50,
    sortBy: 'createdAt' as const,
    sortDirection: 'desc' as const,
  }

  it('filters by name or slug', async () => {
    const { gateway } = makeFakeOrgsGateway({
      orgs: [
        makeOrg({ id: '1', name: 'Alpha', slug: 'alpha' }),
        makeOrg({ id: '2', name: 'Beta', slug: 'b' }),
      ],
    })
    const r1 = await listOrgs(gateway, { ...base, q: 'alph' })
    expect(r1.orgs.map((o) => o.id)).toEqual(['1'])
    const r2 = await listOrgs(gateway, { ...base, q: 'b' })
    expect(r2.orgs.map((o) => o.id).sort()).toEqual(['2'])
  })

  it('paginates 1-indexed', async () => {
    const { gateway } = makeFakeOrgsGateway({
      orgs: Array.from({ length: 5 }, (_, i) =>
        makeOrg({
          id: String(i + 1),
          createdAt: new Date(2025, 0, i + 1),
        }),
      ),
    })
    const p2 = await listOrgs(gateway, { ...base, page: 2, pageSize: 2 })
    expect(p2.orgs).toHaveLength(2)
    expect(p2.total).toBe(5)
  })

  it('clamps pageSize', async () => {
    const { gateway } = makeFakeOrgsGateway()
    const r1 = await listOrgs(gateway, { ...base, pageSize: 0 })
    expect(r1.pageSize).toBe(1)
  })
})
