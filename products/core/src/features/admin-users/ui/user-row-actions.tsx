'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@iedora/design-system'
import { unbanUserAction, impersonateUserAction } from '../actions'
import { BanUserDialog } from './ban-user-dialog'

type Props = {
  userId: string
  userEmail: string
  isBanned: boolean
  /** Disables destructive actions when the row IS the caller. */
  isSelf: boolean
  /** Post-impersonation redirect target — usually the menu app's `/`. */
  postImpersonateUrl: string
}

/**
 * The right-edge action cluster for each row in the users table.
 * Mobile-first: stays a horizontal flex that wraps if it doesn't fit
 * (no overflow menu — three actions is fine inline on phones).
 */
export function UserRowActions({
  userId,
  userEmail,
  isBanned,
  isSelf,
  postImpersonateUrl,
}: Props) {
  const t = useTranslations('Core.admin.users.row')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function unban() {
    startTransition(async () => {
      await unbanUserAction({ userId })
    })
  }

  function impersonate() {
    startTransition(async () => {
      const result = await impersonateUserAction({ userId })
      if (result.ok) {
        // The session cookie has been swapped server-side. Bounce to
        // the app so the new identity takes effect on every request.
        window.location.href = postImpersonateUrl
      }
    })
  }

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-2"
      data-test-id={`admin-users-row-actions-${userId}`}
    >
      <Button
        variant="ghost"
        onClick={() => router.push(`/core/admin/users/${userId}`)}
        data-test-id={`admin-users-row-view-${userId}`}
      >
        {t('view')}
      </Button>

      {!isSelf && (
        <Button
          variant="ghost"
          onClick={impersonate}
          disabled={pending}
          data-test-id={`admin-users-row-impersonate-${userId}`}
        >
          {pending ? t('impersonating') : t('impersonate')}
        </Button>
      )}

      {isBanned ? (
        <Button
          variant="ghost"
          onClick={unban}
          disabled={pending || isSelf}
          data-test-id={`admin-users-row-unban-${userId}`}
        >
          {pending ? t('unbanning') : t('unban')}
        </Button>
      ) : (
        !isSelf && (
          <BanUserDialog
            userId={userId}
            userEmail={userEmail}
            triggerLabel={t('ban')}
          />
        )
      )}
    </div>
  )
}
