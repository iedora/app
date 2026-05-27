'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Badge } from '@iedora/design-system'
import { revokeSessionAction } from '../actions'

type Props = {
  rowId: string
  token: string
  userId: string
  userEmail: string
  userName: string
  ipAddress: string | null
  userAgent: string | null
  createdAtIso: string
  expiresAtIso: string
  impersonatedBy: string | null
}

export function SessionRow({
  rowId,
  token,
  userEmail,
  userName,
  ipAddress,
  userAgent,
  createdAtIso,
  expiresAtIso,
  impersonatedBy,
}: Props) {
  const t = useTranslations('Core.admin.sessions')
  const [pending, startTransition] = useTransition()
  const [revoked, setRevoked] = useState(false)

  if (revoked) return null

  function revoke() {
    startTransition(async () => {
      const result = await revokeSessionAction({ sessionToken: token })
      if (result.ok) setRevoked(true)
    })
  }

  return (
    <tr data-test-id={`admin-session-row-${rowId}`}>
      <td>
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{userName}</span>
          {impersonatedBy ? (
            <Badge data-test-id={`admin-session-impersonation-${rowId}`}>
              {t('impersonatedBadge')}
            </Badge>
          ) : null}
        </div>
        <div className="text-xs text-[var(--ink-70)]">{userEmail}</div>
      </td>
      <td className="text-xs">{userAgent ?? '—'}</td>
      <td className="text-xs">{ipAddress ?? '—'}</td>
      <td className="text-xs whitespace-nowrap">
        {new Date(createdAtIso).toLocaleString()}
      </td>
      <td className="text-xs whitespace-nowrap">
        {new Date(expiresAtIso).toLocaleString()}
      </td>
      <td className="text-right">
        <Button
          variant="ghost"
          onClick={revoke}
          disabled={pending}
          data-test-id={`admin-session-revoke-${rowId}`}
        >
          {pending ? t('revoking') : t('revoke')}
        </Button>
      </td>
    </tr>
  )
}
