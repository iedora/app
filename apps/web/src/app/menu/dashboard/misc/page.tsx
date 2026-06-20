import { getTranslations } from 'next-intl/server'
import { getSession, requireActiveOrganization } from '@iedora/product-menu/features/auth'
import { getOrganizationPlan } from '@iedora/product-menu/features/plans'
import { DashboardPage } from '@iedora/product-menu/shared/ui/dashboard-page'
import { LogoutButton } from '@iedora/product-menu/features/dashboard-home/ui/logout-button'
import { UserLocaleSwitcher } from '@iedora/product-menu/features/dashboard-home/ui/user-locale-switcher'

/**
 * Misc — account odds-and-ends + the account controls (language +
 * sign-out). On mobile the dashboard has no sidebar drawer, so this is
 * where the "Settings" bottom-nav tab lands and the only place the
 * account actions live below `lg`.
 */
export default async function MiscPage() {
  // i18n is independent of auth — fan out. `plan` chains off the same
  // cached org promise.
  const orgPromise = requireActiveOrganization()
  const [, t, plan, session] = await Promise.all([
    orgPromise,
    getTranslations('Misc'),
    orgPromise.then(() => getOrganizationPlan()),
    getSession(),
  ])

  return (
    <DashboardPage
      title={t('title')}
      eyebrow={t(`plans.${plan.code}.name`)}
      description={t('description')}
      data-test-id="misc"
    >
      <section className="space-y-4" data-test-id="misc-account">
        <div className="rounded-[18px] border border-border bg-card p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('account')}
          </p>
          {session?.email ? (
            <p className="mt-0.5 truncate text-[15px] font-semibold text-foreground" title={session.email}>
              {session.email}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <UserLocaleSwitcher />
            <LogoutButton />
          </div>
        </div>
      </section>
    </DashboardPage>
  )
}
