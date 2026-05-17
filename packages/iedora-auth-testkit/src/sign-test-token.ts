import type { TestGenkanHandle } from './start-test-genkan'

export type SignTestTokenOptions = {
  handle: TestGenkanHandle
  /** Subject claim — the user the token represents. */
  userId: string
  /** OAuth/OIDC scopes. Default: `['openid', 'profile', 'email']`. */
  scopes?: string[]
  /** Audience claim. Default: the test instance's issuer URL. */
  audience?: string
}

/**
 * Mint a signed JWT directly — bypassing the OAuth handshake. Useful when a
 * consumer test wants to exercise its session/JWT-verification path without
 * driving the whole authorize/token round-trip.
 *
 * Signs with the same JWKS the test instance exposes at `/.well-known/jwks.json`
 * so consumer code that fetches the keyset and verifies tokens via `jose`
 * works without any test-only override.
 *
 * Backed by Better Auth's `auth.api.signJWT` endpoint, which uses the JWT
 * plugin's RSA key material (lazily generated on first call). The first
 * call therefore takes longer (~50ms) while the keypair is created; later
 * calls are sub-ms.
 */
export async function signTestToken(
  opts: SignTestTokenOptions,
): Promise<string> {
  const scopes = opts.scopes ?? ['openid', 'profile', 'email']
  const audience = opts.audience ?? opts.handle.url

  const result = (await opts.handle.auth.api.signJWT({
    body: {
      payload: {
        sub: opts.userId,
        aud: audience,
        scope: scopes.join(' '),
      },
    },
  })) as { token: string }

  return result.token
}
