'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Combobox } from '@iedora/design-system'
import { setUserRoleAction } from '../actions'
import type { CrossTenantRole } from '../use-cases/set-role'

type Props = {
  userId: string
  currentRole: string | null
  /** Disables the control when the user is the caller. */
  disabled?: boolean
}

export function RoleSelect({ userId, currentRole, disabled }: Props) {
  const t = useTranslations('Core.admin.users.role')
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  function change(next: string | null) {
    const role = (next || null) as CrossTenantRole | null
    if (role === (currentRole as CrossTenantRole | null)) return
    setStatus('idle')
    startTransition(async () => {
      const result = await setUserRoleAction({ userId, role })
      setStatus(result.ok ? 'ok' : 'err')
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Combobox
        value={currentRole}
        onChange={change}
        disabled={disabled || pending}
        options={[
          { value: 'iedora-admin', label: t('iedoraAdmin') },
        ]}
        placeholder={t('member')}
        clearable
        data-test-id={`admin-users-role-select-${userId}`}
      />
      {status === 'ok' && (
        <p
          role="status"
          className="text-xs text-[var(--ink-70)]"
          data-test-id={`admin-users-role-status-${userId}`}
        >
          {t('updated')}
        </p>
      )}
      {status === 'err' && (
        <p
          role="alert"
          className="text-xs text-[var(--cinnabar)]"
          data-test-id={`admin-users-role-error-${userId}`}
        >
          {t('errorGeneric')}
        </p>
      )}
    </div>
  )
}
