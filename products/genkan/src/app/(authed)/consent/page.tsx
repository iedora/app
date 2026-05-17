import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/features/auth/adapters/better-auth-instance'
import { db } from '@/shared/db/client'
import { oauthClient } from '@/shared/db/schema'
import { ConsentForm } from './consent-form'

export const metadata = { title: 'Authorize' }

/**
 * Consent page. Reached when a third-party OAuth client (one without
 * `skipConsent: true`) requests authorization. The user accepts or denies
 * the requested scopes — first-party trusted clients (menu, etc.) bypass
 * this screen entirely.
 *
 * Better Auth passes client_id + scope as query params. We hydrate the
 * client metadata (name / uri) from oauth_client so the user knows what
 * they're authorizing.
 */
type SearchParams = Promise<{ client_id?: string; scope?: string }>

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const params = await searchParams
  const clientId = params.client_id ?? ''
  const requestedScopes = (params.scope ?? '').split(' ').filter(Boolean)

  if (!clientId || requestedScopes.length === 0) {
    redirect('/profile')
  }

  const [client] = await db
    .select({
      clientId: oauthClient.clientId,
      name: oauthClient.name,
      uri: oauthClient.uri,
    })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId))
    .limit(1)

  const clientName = client?.name ?? clientId

  return (
    <div style={{ display: 'grid', gap: 'var(--s-8)', maxWidth: 560 }}>
      <header style={{ display: 'grid', gap: 'var(--s-2)' }}>
        <span className="eyebrow">/ AUTHORIZE</span>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--serif)',
            fontWeight: 300,
            fontSize: 'clamp(28px, 7vw, 48px)',
            lineHeight: 'var(--lh-snug)',
            letterSpacing: '-0.02em',
          }}
        >
          <em style={{ fontStyle: 'italic', fontWeight: 400 }}>{clientName}</em>{' '}
          would like to enter
          <span style={{ color: 'var(--cinnabar)' }}>.</span>
        </h1>
        {client?.uri ? (
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: '0.12em',
              color: 'var(--ink-55)',
              wordBreak: 'break-all',
            }}
          >
            {client.uri}
          </p>
        ) : null}
      </header>

      <section
        style={{
          paddingTop: 'var(--s-5)',
          borderTop: 'var(--hairline) solid var(--ink-14)',
          display: 'grid',
          gap: 'var(--s-4)',
        }}
      >
        <span className="eyebrow">It is asking for</span>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: 'var(--s-2)',
            fontFamily: 'var(--serif)',
            fontSize: 'var(--t-lg)',
            color: 'var(--ink)',
          }}
        >
          {requestedScopes.map((s) => (
            <li key={s}>
              <code
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--t-sm)',
                  color: 'var(--ink-70)',
                }}
              >
                {s}
              </code>
              <span
                style={{
                  fontStyle: 'italic',
                  color: 'var(--ink-55)',
                  marginLeft: 'var(--s-3)',
                }}
              >
                {describeScope(s)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ConsentForm scope={requestedScopes.join(' ')} />
    </div>
  )
}

function describeScope(scope: string): string {
  switch (scope) {
    case 'openid':
      return 'your stable identifier'
    case 'profile':
      return 'your name and avatar'
    case 'email':
      return 'your email address'
    case 'offline_access':
      return 'stay signed in when you leave'
    case 'menu':
      return 'access the Menu work'
    case 'org:read':
      return 'read the rooms you belong to'
    case 'org:admin':
      return 'create and edit those rooms'
    default:
      return scope
  }
}
