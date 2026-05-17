/**
 * Same as ../route.ts but at the RFC 8414 path-suffixed location. When an
 * OIDC authorization server lives at a non-root path (here: `/api/auth`),
 * RFC 8414 § 3.1 specifies the discovery URL is
 * `/.well-known/openid-configuration/<path>` — i.e. `/api/auth` appended.
 *
 * Better Auth itself warns about this on boot: "Please ensure
 * '/.well-known/oauth-authorization-server/api/auth' exists." Same idea
 * here for the OIDC sibling.
 */
export { GET, dynamic } from '../route'
