import { auth } from '@/features/auth/adapters/better-auth-instance'

/**
 * OIDC discovery — `https://genkan.iedora.com/.well-known/openid-configuration`.
 *
 * Better Auth's oauth-provider plugin computes the metadata internally but
 * marks the endpoint SERVER_ONLY so it isn't auto-routed under `/api/auth/*`.
 * We expose it at the standard root path here so any OIDC client library
 * (better-auth/generic-oauth, .NET JwtBearer, oidc-client-ts, etc.) finds
 * the configuration without bespoke wiring.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  // Calling the SERVER_ONLY helper directly — Better Auth exposes the
  // metadata-building function on auth.api even though the public route is
  // disabled.
  const config = await auth.api.getOpenIdConfig()
  return Response.json(config, {
    headers: { 'cache-control': 'public, max-age=300' },
  })
}
