'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Combobox } from '@iedora/design-system'
import { removeMemberAction, updateMemberRoleAction } from '../actions'

type Props = {
  organizationId: string
  memberId: string
  memberUserId: string
  memberEmail: string
  currentRole: string
}

const ORG_ROLES = ['owner', 'admin', 'member'] as const

export function MemberRowActions({
  organizationId,
  memberId,
  memberEmail,
  currentRole,
}: Props) {
  const t = useTranslations('Core.admin.orgs.members')
  const [pending, startTransition] = useTransition()
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  function changeRole(next: string | null) {
    if (!next || next === currentRole) return
    startTransition(async () => {
      await updateMemberRoleAction({ organizationId, memberId, role: next })
    })
  }

  function remove() {
    startTransition(async () => {
      await removeMemberAction({
        organizationId,
        memberIdOrEmail: memberEmail,
      })
    })
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 justify-end"
      data-test-id={`admin-orgs-member-actions-${memberId}`}
    >
      <Combobox
        value={currentRole}
        onChange={changeRole}
        disabled={pending}
        options={ORG_ROLES.map((r) => ({ value: r, label: t(`role-${r}`) }))}
        data-test-id={`admin-orgs-member-role-${memberId}`}
      />
      {confirmingRemove ? (
        <>
          <Button
            variant="primary"
            onClick={remove}
            disabled={pending}
            data-test-id={`admin-orgs-member-confirm-remove-${memberId}`}
          >
            {pending ? t('removing') : t('confirmRemove')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setConfirmingRemove(false)}
            disabled={pending}
          >
            {t('cancel')}
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          onClick={() => setConfirmingRemove(true)}
          data-test-id={`admin-orgs-member-remove-${memberId}`}
        >
          {t('remove')}
        </Button>
      )}
    </div>
  )
}
