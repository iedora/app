import { describe, expect, it } from 'vitest'
import { requireFreshSession } from '../use-cases/require-fresh-session'
import type { AuthGateway } from '../ports'

/**
 * Smoke-level test for the step-up DAL guard. We don't spin up Better Auth
 * or Drizzle here — the guard's contract is `(AuthGateway, options) →
 * redirect-or-return`, so a hand-rolled fake gateway is enough to cover
 * the three branches.
 *
 * `redirect()` in Next 16 throws an error whose `digest` is
 * `NEXT_REDIRECT;<type>;<url>;<status>;`. We inspect the digest to assert
 * the right URL was chosen.
 */

const FAKE_USER = { id: 'u1', email: 'a@b.c' }

function fakeGateway(session: unknown): AuthGateway {
  return {
    // The guard only reads `.user` + `.session.lastPasswordAt`, so the
    // type cast is fine for this smoke test.
    getSession: async () => session as Awaited<ReturnType<AuthGateway['getSession']>>,
    findEarliestOrgMembership: async () => null,
  }
}

function expectRedirectTo(err: unknown, expectedUrlPrefix: string) {
  expect(err).toBeInstanceOf(Error)
  const digest = (err as Error & { digest?: string }).digest ?? ''
  // Format: NEXT_REDIRECT;<type>;<url>;<status>;
  expect(digest).toMatch(/^NEXT_REDIRECT;/)
  const parts = digest.split(';')
  // url is parts[2..n-2] joined (no semicolons in our URLs, so parts[2])
  const url = parts[2]
  expect(url).toMatch(new RegExp('^' + expectedUrlPrefix))
}

describe('requireFreshSession', () => {
  it('redirects to /login when no session exists', async () => {
    const gateway = fakeGateway(null)
    let caught: unknown
    try {
      await requireFreshSession(gateway, { returnTo: '/admin/users/u9' })
    } catch (e) {
      caught = e
    }
    expectRedirectTo(caught, '/login\\?return_to=')
  })

  it('redirects to /reauth when session is older than maxAgeMin', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    const gateway = fakeGateway({
      user: FAKE_USER,
      session: { id: 's1', lastPasswordAt: tenMinutesAgo },
    })
    let caught: unknown
    try {
      await requireFreshSession(gateway, {
        maxAgeMin: 5,
        returnTo: '/admin/users/u9',
      })
    } catch (e) {
      caught = e
    }
    expectRedirectTo(caught, '/reauth\\?return_to=')
  })

  it('returns the session when freshness window not yet expired', async () => {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    const session = {
      user: FAKE_USER,
      session: { id: 's1', lastPasswordAt: oneMinuteAgo },
    }
    const gateway = fakeGateway(session)
    const result = await requireFreshSession(gateway, {
      maxAgeMin: 5,
      returnTo: '/admin/users/u9',
    })
    expect(result).toBe(session)
  })

  it('treats missing lastPasswordAt as stale (redirect to /reauth)', async () => {
    const gateway = fakeGateway({
      user: FAKE_USER,
      session: { id: 's1' }, // no lastPasswordAt
    })
    let caught: unknown
    try {
      await requireFreshSession(gateway, { returnTo: '/admin' })
    } catch (e) {
      caught = e
    }
    expectRedirectTo(caught, '/reauth\\?return_to=')
  })

  it('accepts an ISO string lastPasswordAt (cache-serialized)', async () => {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
    const session = {
      user: FAKE_USER,
      session: { id: 's1', lastPasswordAt: oneMinuteAgo },
    }
    const gateway = fakeGateway(session)
    const result = await requireFreshSession(gateway, { maxAgeMin: 5 })
    expect(result).toBe(session)
  })
})
