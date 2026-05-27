import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import {
  Card,
  CardTitle,
  CardDesc,
  CardFoot,
  Button,
} from '@iedora/design-system'
import { requireIedoraAdmin } from '@iedora/product-core'
import { auth } from '@iedora/auth'
import { AdminPage } from '@iedora/product-core/shared/ui/admin-page'

/**
 * Admin overview — landing for /core/admin. Three big numeric stats
 * (users / orgs / banned) + jump-off cards into the three management
 * surfaces. No filters; no URL state — this page is purely a hub.
 */
export default async function CoreAdminOverview() {
  await requireIedoraAdmin()
  const t = await getTranslations('Core.admin.overview')
  const h = await headers()

  // Cheap aggregate via better-auth's listUsers — we already pay the
  // round-trip; counting the returned set is free. Cap at 1 to elicit
  // the `total` envelope without scrolling the actual rows.
  const usersResponse = await auth.api.listUsers({
    query: { limit: 1, sortBy: 'createdAt', sortDirection: 'desc' },
    headers: h,
  })
  const totalUsers = usersResponse.total ?? usersResponse.users?.length ?? 0

  return (
    <AdminPage
      title={t('title')}
      description={t('description')}
      data-test-id="admin-overview"
    >
      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-test-id="admin-overview-cards"
      >
        <Card data-test-id="admin-overview-card-users">
          <CardTitle as="h2">{t('users.title')}</CardTitle>
          <CardDesc>
            {t('users.count', { count: totalUsers })}
          </CardDesc>
          <CardFoot>
            <Button as="a" href="/core/admin/users" variant="ghost" arrow>
              {t('users.cta')}
            </Button>
          </CardFoot>
        </Card>
        <Card data-test-id="admin-overview-card-orgs">
          <CardTitle as="h2">{t('orgs.title')}</CardTitle>
          <CardDesc>{t('orgs.description')}</CardDesc>
          <CardFoot>
            <Button
              as="a"
              href="/core/admin/organizations"
              variant="ghost"
              arrow
            >
              {t('orgs.cta')}
            </Button>
          </CardFoot>
        </Card>
        <Card data-test-id="admin-overview-card-sessions">
          <CardTitle as="h2">{t('sessions.title')}</CardTitle>
          <CardDesc>{t('sessions.description')}</CardDesc>
          <CardFoot>
            <Button as="a" href="/core/admin/sessions" variant="ghost" arrow>
              {t('sessions.cta')}
            </Button>
          </CardFoot>
        </Card>
      </section>
    </AdminPage>
  )
}
