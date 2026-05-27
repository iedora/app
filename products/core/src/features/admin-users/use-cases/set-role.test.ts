import { describe, it, expect } from 'vitest'
import { setUserRole } from './set-role'
import { makeFakeGateway, makeUser } from '../testing/fake-gateway'

describe('setUserRole', () => {
  it('grants iedora-admin', async () => {
    const { gateway, state } = makeFakeGateway({
      users: [makeUser({ id: 'target', role: null })],
    })
    const result = await setUserRole(gateway, {
      userId: 'target',
      role: 'iedora-admin',
      callerUserId: 'admin',
    })
    expect(result).toEqual({ ok: true })
    expect(state.users[0]?.role).toBe('iedora-admin')
  })

  it('clears the role with null', async () => {
    const { gateway, state } = makeFakeGateway({
      users: [makeUser({ id: 'target', role: 'iedora-admin' })],
    })
    await setUserRole(gateway, {
      userId: 'target',
      role: null,
      callerUserId: 'admin',
    })
    expect(state.users[0]?.role).toBeNull()
  })

  it('refuses to change the caller\'s own role', async () => {
    const { gateway, state } = makeFakeGateway({
      users: [makeUser({ id: 'admin', role: 'iedora-admin' })],
    })
    const result = await setUserRole(gateway, {
      userId: 'admin',
      role: null,
      callerUserId: 'admin',
    })
    expect(result).toEqual({ ok: false, error: { code: 'self-target' } })
    expect(state.calls.setRole).toHaveLength(0)
  })
})
