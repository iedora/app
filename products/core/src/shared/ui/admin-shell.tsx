import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { BRAND_URL } from '@iedora/brand'
import {
  Sidebar,
  SidebarBrand,
  SidebarClose,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
  Wordmark,
} from '@iedora/design-system'
import { ActiveSidebarLinks, type ActiveSidebarItem } from './active-sidebar-links'

/**
 * Cross-tenant admin chrome. Two-column on lg+, drawer on mobile.
 * No restaurant context — the sidebar is a fixed taxonomy of admin
 * surfaces (overview / users / orgs / sessions). Keep the taxonomy
 * short — if it grows past five, add a second section group.
 */
export async function AdminShell({
  children,
  userEmail,
}: {
  children: React.ReactNode
  userEmail: string
}) {
  const t = await getTranslations('Core.admin.nav')

  const items: ReadonlyArray<ActiveSidebarItem> = [
    {
      kind: 'section',
      label: t('sectionAdmin'),
      testId: 'admin-nav-section-admin',
    },
    {
      href: '/core/admin',
      label: t('overview'),
      matchPrefix: false,
      testId: 'admin-nav-overview',
    },
    {
      href: '/core/admin/users',
      label: t('users'),
      testId: 'admin-nav-users',
    },
    {
      href: '/core/admin/organizations',
      label: t('organizations'),
      testId: 'admin-nav-organizations',
    },
    {
      href: '/core/admin/sessions',
      label: t('sessions'),
      testId: 'admin-nav-sessions',
    },
    { kind: 'section', label: t('sectionExit'), testId: 'admin-nav-section-exit' },
    { href: '/sign-out', label: t('signOut'), testId: 'admin-nav-sign-out' },
  ]

  return (
    <SidebarProvider>
      <div className="flex min-h-screen flex-col bg-[var(--paper)] lg:flex-row">
        <SidebarTrigger
          aria-label={t('openNavigation')}
          data-test-id="admin-sidebar-trigger"
        />

        <Sidebar aria-label={t('ariaLabel')} data-test-id="admin-chrome">
          <SidebarClose
            aria-label={t('closeNavigation')}
            data-test-id="admin-sidebar-close"
          />
          <SidebarBrand>
            <Link
              href={BRAND_URL}
              className="brand"
              aria-label={t('brandHome')}
              data-test-id="admin-home-link"
            >
              <Wordmark word="admin" variant="inline" className="ds-wordmark--reveal" />
            </Link>
          </SidebarBrand>

          <ActiveSidebarLinks ariaLabel={t('ariaLabel')} items={items} />

          <SidebarFooter>
            <span
              className="min-w-0 truncate font-[family-name:var(--mono)] text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-40)]"
              title={userEmail}
              data-test-id="admin-user-email"
            >
              {userEmail}
            </span>
          </SidebarFooter>
        </Sidebar>

        <main className="ds-shell flex-1 pt-5 pb-10 sm:pt-7 sm:pb-14 lg:pt-8 lg:pb-16 px-4 sm:px-6 lg:px-10">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}
