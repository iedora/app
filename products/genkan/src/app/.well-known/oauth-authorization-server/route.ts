import { auth } from '@/features/auth/adapters/better-auth-instance'

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414).
 *
 * The non-OIDC sibling of /.well-known/openid-configuration — exposes the
 * same surface minus the OIDC-specific fields (id_token_signing_alg_values
 * etc.). Useful for clients that speak pure OAuth without the OIDC
 * subset, or that prefer the more recent RFC 8414 discovery path.
 *
 * Better Auth marks the endpoint SERVER_ONLY; this Next route forwards to
 * the helper.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const config = await auth.api.getOAuthServerConfig()
  return Response.json(config, {
    headers: { 'cache-control': 'public, max-age=300' },
  })
}
