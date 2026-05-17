import Link from 'next/link'
import { MetaStrip, Wordmark } from '@iedora/design-system'
import { requireAdmin } from '@/features/admin'

/**
 * Chrome for /admin/*. Quiet MetaStrip + wordmark + nav.
 *
 * The guard at the top redirects/notFound()s before any child renders. Next
 * 16 layouts don't re-render on navigation, so this single check at the top
 * is *not* enough on its own — every page also calls `requireAdmin()` so a
 * stale layout never gates a leaked URL.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAdmin()

  const navLinkStyle: React.CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize: 10.5,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--ink-55)',
    textDecoration: 'none',
  }

  return (
    <div
      className="ds-root ds-root--washed"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          width: 'min(1320px, 100%)',
          margin: '0 auto',
          padding: '24px 56px 0',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <MetaStrip
          left={
            <>
              <span>MMXXVI</span>
              <span>Genkan · Admin</span>
            </>
          }
          right={
            <span style={navLinkStyle} title={session.user.email}>
              {session.user.email}
            </span>
          }
        />
      </div>

      <header
        style={{
          width: 'min(1320px, 100%)',
          margin: '0 auto',
          padding: '24px 56px 28px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 24,
          borderBottom: '1px solid var(--ink-14)',
        }}
      >
        <Link
          href="/admin"
          style={{ textDecoration: 'none', display: 'inline-flex' }}
          aria-label="Admin home"
        >
          <Wordmark word="genkan" variant="inline" />
        </Link>
        <nav style={{ display: 'flex', gap: 22, alignItems: 'baseline' }}>
          <Link href="/admin/users" style={navLinkStyle}>
            Users
          </Link>
          <Link href="/admin/organizations" style={navLinkStyle}>
            Organizations
          </Link>
          <Link href="/admin/applications" style={navLinkStyle}>
            Applications
          </Link>
          <Link href="/admin/webhooks" style={navLinkStyle}>
            Webhooks
          </Link>
          <Link href="/admin/grants" style={navLinkStyle}>
            Grants
          </Link>
          <Link href="/admin/sessions" style={navLinkStyle}>
            Sessions
          </Link>
          <Link href="/admin/audit" style={navLinkStyle}>
            Audit
          </Link>
        </nav>
      </header>

      <main
        style={{
          width: 'min(1320px, 100%)',
          margin: '0 auto',
          padding: '40px 56px 96px',
          flex: 1,
        }}
      >
        {children}
      </main>
    </div>
  )
}
