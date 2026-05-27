'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@iedora/design-system'
import { cancelInvitationAction } from '../actions'

export function CancelInvitationButton({
  organizationId,
  invitationId,
}: {
  organizationId: string
  invitationId: string
}) {
  const t = useTranslations('Core.admin.orgs.invitations')
  const [pending, startTransition] = useTransition()

  function cancel() {
    startTransition(async () => {
      await cancelInvitationAction({ organizationId, invitationId })
    })
  }

  return (
    <Button
      variant="ghost"
      onClick={cancel}
      disabled={pending}
      data-test-id={`admin-orgs-invitation-cancel-${invitationId}`}
    >
      {pending ? t('cancelling') : t('cancel')}
    </Button>
  )
}
