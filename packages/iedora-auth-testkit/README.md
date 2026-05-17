# @iedora/auth-testkit

In-process Better Auth + OAuth-provider test fixture, backed by PGLite.

Every iedora service that consumes [genkan](../../products/genkan) via OIDC needs
to exercise real OAuth flows in its integration tests. Spinning up a
containerised genkan per test is slow (5-10s, plus version coupling).
This package gives every service the SAME Better Auth code that runs in
production, just configured for tests and PGLite-backed. Cold start: ~150ms.

## What you get

- A real HTTP server (`node:http`) listening on a random local port.
- Better Auth wired with the same plugin set genkan runs in production
  (`organization`, `admin`, `jwt`, `@better-auth/oauth-provider`).
- PGLite-backed Postgres applying genkan's migrations on every boot.
- Trusted client seeding so the OAuth handshake skips consent.
- Convenience seeds for users, organizations, members, consents.
- A `signTestToken` helper that bypasses the handshake for unit-grade tests.

## Worked example

```ts
import { afterAll, beforeAll, describe, it } from 'vitest'
import { startTestGenkan } from '@iedora/auth-testkit'

let genkan: Awaited<ReturnType<typeof startTestGenkan>>

beforeAll(async () => {
  genkan = await startTestGenkan({
    clients: [{
      client_id: 'test-app',
      client_secret: 't3st',
      redirect_uris: ['http://localhost:3000/callback'],
    }],
  })
})

afterAll(() => genkan.stop())

describe('SSO', () => {
  it('exposes a working discovery URL', async () => {
    // Wire the test app's Better Auth `genericOAuth` plugin like this:
    //
    //   genericOAuth({
    //     config: [{
    //       providerId: 'genkan',
    //       discoveryUrl: genkan.discoveryUrl,
    //       clientId: 'test-app',
    //       clientSecret: 't3st',
    //     }],
    //   })
    //
    // Then drive a signup or sign-in through your own authClient against
    // the local app, and the OAuth bounce will land back on the test
    // server, complete the code exchange, and your test-app session
    // table will hold the new account.
  })

  it('can mint a token directly when the handshake itself is not under test', async () => {
    const user = await genkan.seed.user({
      name: 'Eduardo',
      email: 'eduardo@example.com',
      password: 'correct-horse-battery-staple',
    })
    const org = await genkan.seed.organization({
      name: 'Test Org', slug: 'test-org', ownerId: user.id,
    })
    const { signTestToken } = await import('@iedora/auth-testkit')
    const token = await signTestToken({
      handle: genkan,
      userId: user.id,
      scopes: ['openid', 'menu'],
    })
    // Now hit your service's protected route with `Authorization: Bearer ${token}`
    // and assert it accepts the token (the service should verify against
    // genkan.discoveryUrl, which serves the public JWKS).
  })
})
```

## API

### `startTestGenkan(opts?)` → `Promise<TestGenkanHandle>`

| option       | default                          | meaning |
|--------------|----------------------------------|---------|
| `clients`    | `[]`                             | Pre-registered trusted clients (`skipConsent=true` on every entry) |
| `port`       | `0` (random)                     | Listening port |
| `baseUrl`    | `http://localhost:${port}`       | Issuer URL — also sets `trustedOrigins` |
| `authSecret` | random 32-byte base64url         | HMAC signing secret (Better Auth's `BETTER_AUTH_SECRET`) |

Returns:

```ts
{
  url: string                  // http://localhost:54321
  discoveryUrl: string         // ${url}/.well-known/openid-configuration
  stop(): Promise<void>
  seed: TestGenkanSeeds        // user / organization / member / grant
  auth: BetterAuthInstance     // opaque; exposed so signTestToken works
  db: DrizzlePglite            // opaque; tests in this package introspect it
}
```

### `signTestToken({ handle, userId, scopes?, audience? })` → `Promise<string>`

Mints a JWT signed by the test instance's JWKS. The same keyset the consumer
fetches via `discoveryUrl` will verify the token.

## Constraints

- TypeScript strict.
- PGLite is the only new dep — `better-auth`, `@better-auth/oauth-provider`,
  and `drizzle-orm` are peer deps and resolve to whatever version genkan
  uses in the same workspace.
- Schema source: re-exported from `products/genkan/src/shared/db/schema.ts`
  via relative import. The drizzle migration SQL is discovered at runtime by
  walking up from `import.meta.url` to `products/genkan/drizzle/*.sql`.
- Each `startTestGenkan()` call returns a fresh, isolated instance.
- Cold-start budget: 500ms target, 1500ms hard ceiling (enforced by
  `smoke.test.ts`).
