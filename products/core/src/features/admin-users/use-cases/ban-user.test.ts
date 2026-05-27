import { describe, it, expect } from 'vitest'
import { banUser } from './ban-user'
import { unbanUser } from './unban-user'
import { makeFakeGateway, makeUser } from '../testing/fake-gateway'

describe('banUser', () => {
  it('bans a user permanently when expiresInDays is omitted', async () => {
    const { gateway, state } = makeFakeGateway({
      users: [makeUser({ id: 'target' })],
    })
    const result = await banUser(gateway, {
      userId: 'target',
      callerUserId: 'admin',
      reason: 'Spam',
    })
    expect(result).toEqual({ ok: true })
    expect(state.calls.banUser).toEqual([
      { userId: 'target', reason: 'Spam', expiresInSec: undefined },
    ])
    expect(state.users[0]?.banned).toBe(true)
    expect(state.users[0]?.banExpires).toBeNull()
  })

  it('converts expiresInDays to seconds', async () => {
    const { gateway, state } = makeFakeGateway({
      users: [makeUser({ id: 'target' })],
    })
    await banUser(gateway, {
      userId: 'target',
      callerUserId: 'admin',
      expiresInDays: 7,
    })
    expect(state.calls.banUser[0]?.expiresInSec).toBe(7 * 24 * 60 * 60)
  })

  it('refuses to ban the caller themselves', async () => {
    const { gateway, state } = makeFakeGateway({
      users: [makeUser({ id: 'admin' })],
    })
    const result = await banUser(gateway, {
      userId: 'admin',
      callerUserId: 'admin',
    })
    expect(result).toEqual({ ok: false, error: { code: 'self-target' } })
    expect(state.calls.banUser).toHaveLength(0)
  })

  it('treats whitespace-only reason as no reason', async () => {
    const { gateway, state } = makeFakeGateway({
      users: [makeUser({ id: 'target' })],
    })
    await banUser(gateway, {
      userId: 'target',
      callerUserId: 'admin',
      reason: '   ',
    })
    expect(state.calls.banUser[0]?.reason).toBeUndefined()
  })
})

describe('unbanUser', () => {
  it('lifts an existing ban', async () => {
    const { gateway, state } = makeFakeGateway({
      users: [makeUser({ id: 'target', banned: true, banReason: 'x' })],
    })
    await unbanUser(gateway, { userId: 'target' })
    expect(state.users[0]?.banned).toBe(false)
    expect(state.users[0]?.banReason).toBeNull()
  })
})
