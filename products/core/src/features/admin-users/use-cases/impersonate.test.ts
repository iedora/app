import { describe, it, expect } from 'vitest'
import { impersonateUser } from './impersonate'
import { makeFakeGateway, makeUser } from '../testing/fake-gateway'

describe('impersonateUser', () => {
  it('calls the gateway with the target id', async () => {
    const { gateway, state } = makeFakeGateway({
      users: [makeUser({ id: 'target' })],
    })
    const result = await impersonateUser(gateway, {
      userId: 'target',
      callerUserId: 'admin',
    })
    expect(result).toEqual({ ok: true })
    expect(state.calls.impersonateUser).toEqual([{ userId: 'target' }])
  })

  it('refuses self-impersonation', async () => {
    const { gateway, state } = makeFakeGateway({
      users: [makeUser({ id: 'admin' })],
    })
    const result = await impersonateUser(gateway, {
      userId: 'admin',
      callerUserId: 'admin',
    })
    expect(result).toEqual({ ok: false, error: { code: 'self-target' } })
    expect(state.calls.impersonateUser).toHaveLength(0)
  })
})
