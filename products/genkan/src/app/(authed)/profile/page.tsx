import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge, EmptyState, Separator } from '@iedora/design-system'
import { auth } from '@/features/auth/adapters/better-auth-instance'
import { listUserGrants, listProfileOrganizations } from '@/features/profile'
import { revokeGrant } from './actions'

export const metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const userId = session.user.id
  const [grants, organizations] = await Promise.all([
    listUserGrants(userId),
    listProfileOrganizations(userId),
  ])

  return (
    <div style={{ display: 'grid', gap: 'var(--s-9)', maxWidth: 760 }}>
      <header style={{ display: 'grid', gap: 'var(--s-2)' }}>
        <span className="eyebrow">/ 01 ACCOUNT</span>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--serif)',
            fontWeight: 300,
            fontSize: 'clamp(32px, 9vw, 64px)',
            lineHeight: 'var(--lh-tight)',
            letterSpacing: '-0.025em',
          }}
        >
          {session.user.name}
          <span style={{ color: 'var(--cinnabar)' }}>.</span>
        </h1>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 'var(--t-lg)',
            color: 'var(--ink-70)',
            wordBreak: 'break-word',
          }}
        >
          {session.user.email}
        </p>
      </header>

      <Separator />

      <section style={{ display: 'grid', gap: 'var(--s-5)' }}>
        <span className="eyebrow">/ 02 PRODUCTS</span>
        {grants.length === 0 ? (
          <EmptyState
            label="No products yet"
            note="When you sign in to a work for the first time, it lands here."
          />
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: 'var(--s-5)',
            }}
          >
            {grants.map((g) => (
              <li
                key={g.consentId}
                className="ds-profile-row ds-profile-row--ruled"
              >
                <div style={{ display: 'grid', gap: 'var(--s-1)' }}>
                  <div
                    style={{
                      fontFamily: 'var(--serif)',
                      fontSize: 'var(--t-xl)',
                      letterSpacing: '-0.015em',
                    }}
                  >
                    {g.clientName}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 'var(--t-2xs)',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-55)',
                      display: 'flex',
                      gap: 'var(--s-2)',
                      flexWrap: 'wrap',
                    }}
                  >
                    {g.scopes.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                </div>
                <form action={revokeGrant} className="ds-profile-row__action">
                  <input type="hidden" name="consentId" value={g.consentId} />
                  <button type="submit" className="ds-revoke-btn">
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator />

      <section style={{ display: 'grid', gap: 'var(--s-5)' }}>
        <span className="eyebrow">/ 03 ORGANIZATIONS</span>
        {organizations.length === 0 ? (
          <EmptyState
            label="No organizations yet"
            note="Create one when you onboard a restaurant in Menu."
          />
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: 'var(--s-4)',
            }}
          >
            {organizations.map((o) => (
              <li key={o.id} className="ds-profile-row">
                <div style={{ display: 'grid', gap: 'var(--s-1)' }}>
                  <span
                    style={{
                      fontFamily: 'var(--serif)',
                      fontSize: 'var(--t-xl)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {o.name}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 'var(--t-2xs)',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-55)',
                    }}
                  >
                    /{o.slug}
                  </span>
                </div>
                <div className="ds-profile-row__action">
                  <Badge>{o.role}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {session.user.role === 'admin' ? (
        <>
          <Separator />
          <section style={{ display: 'grid', gap: 'var(--s-3)' }}>
            <span className="eyebrow">/ 04 ADMIN</span>
            <p
              style={{
                fontFamily: 'var(--serif)',
                fontSize: 'var(--t-lg)',
                color: 'var(--ink-70)',
                maxWidth: 'var(--measure)',
                margin: 0,
              }}
            >
              You have platform-admin access. Manage users, organizations, and
              registered applications.
            </p>
            <Link href="/admin" className="ds-revoke-btn">
              Open admin →
            </Link>
          </section>
        </>
      ) : null}
    </div>
  )
}
