/**
 * @iedora/auth-testkit — in-process Better Auth + OAuth-provider test fixture.
 *
 * Consumers (menu, future .NET API, future Go service) use this to spin up a
 * real OIDC provider inside their test process, bound to a random local
 * port and backed by PGLite. Same Better Auth code that runs in production,
 * just configured for tests — so integration tests exercise the actual
 * handshake instead of mocking it.
 *
 * Public API:
 *   - `startTestGenkan(opts?)` — boot a fresh instance, return a handle.
 *   - `signTestToken({ handle, userId, ... })` — mint a signed JWT directly.
 *
 * See ./README.md for the worked example.
 */
export {
  startTestGenkan,
  type TestGenkanHandle,
  type TestGenkanOptions,
  type TestGenkanSeeds,
  type TestClient,
} from './start-test-genkan'

export { signTestToken, type SignTestTokenOptions } from './sign-test-token'
