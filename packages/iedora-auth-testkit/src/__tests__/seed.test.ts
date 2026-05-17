import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { startTestGenkan, type TestGenkanHandle } from '../index'
import * as schema from '../schema'

describe('seed helpers', () => {
  let handle: TestGenkanHandle

  beforeAll(async () => {
    handle = await startTestGenkan({
      clients: [
        {
          client_id: 'menu',
          client_secret: 'menu-secret',
          redirect_uris: ['http://localhost:3000/api/auth/oauth2/callback/genkan'],
        },
      ],
    })
  })

  afterAll(async () => {
    await handle.stop()
  })

  it('seeds a trusted client row at startup with the SHA-256+base64url secret', async () => {
    const [row] = await handle.db
      .select()
      .from(schema.oauthClient)
      .where(eq(schema.oauthClient.clientId, 'menu'))
      .limit(1)

    expect(row).toBeDefined()
    expect(row?.skipConsent).toBe(true)
    expect(row?.redirectUris).toEqual([
      'http://localhost:3000/api/auth/oauth2/callback/genkan',
    ])
    // The hash of "menu-secret" via sha256+base64url — pre-computed:
    //   $ echo -n menu-secret | openssl dgst -sha256 -binary | basenc --base64url | tr -d =
    // Just assert it's not the plaintext.
    expect(row?.clientSecret).not.toBe('menu-secret')
    expect(row?.clientSecret).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('seed.user → seed.organization → seed.member round-trips through the DB', async () => {
    const u = await handle.seed.user({
      name: 'Eduardo',
      email: 'eduardo+seed@example.com',
      password: 'correct-horse-battery-staple',
    })
    expect(u.id).toBeTypeOf('string')
    expect(u.email).toBe('eduardo+seed@example.com')

    const org = await handle.seed.organization({
      name: 'Test Org',
      slug: 'test-org',
      ownerId: u.id,
    })
    expect(org.slug).toBe('test-org')

    // createOrganization in Better Auth auto-adds the creator as owner.
    // Verify a second user can be added as a `member` explicitly.
    const u2 = await handle.seed.user({
      name: 'Member User',
      email: 'member@example.com',
      password: 'correct-horse-battery-staple',
    })
    await handle.seed.member({ orgId: org.id, userId: u2.id, role: 'member' })

    const members = await handle.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.organizationId, org.id))
    const userIds = members.map((m) => m.userId).sort()
    expect(userIds).toContain(u.id)
    expect(userIds).toContain(u2.id)
  })

  it('seed.grant inserts an oauth_consent row that the OAuth flow can read', async () => {
    const u = await handle.seed.user({
      name: 'Grant Owner',
      email: 'grant@example.com',
      password: 'correct-horse-battery-staple',
    })
    const { consentId } = await handle.seed.grant({
      userId: u.id,
      clientId: 'menu',
      scopes: ['openid', 'profile', 'menu'],
    })
    expect(consentId).toMatch(/^consent_/)

    const [row] = await handle.db
      .select()
      .from(schema.oauthConsent)
      .where(eq(schema.oauthConsent.id, consentId))
      .limit(1)
    expect(row?.scopes).toEqual(['openid', 'profile', 'menu'])

    // Re-running with different scopes UPSERTs.
    await handle.seed.grant({
      userId: u.id,
      clientId: 'menu',
      scopes: ['openid', 'email'],
    })
    const [updated] = await handle.db
      .select()
      .from(schema.oauthConsent)
      .where(eq(schema.oauthConsent.id, consentId))
      .limit(1)
    expect(updated?.scopes).toEqual(['openid', 'email'])
  })
})
