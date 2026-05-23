'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@iedora/design-system'
import { refreshTranslationsAction } from '../actions'
import type { RefreshResult } from '../use-cases/refresh-translations'

/**
 * Single-button affordance for syncing a restaurant's translations.
 * Reads "Refresh translations" by default; flips through a pending /
 * result state so the operator gets a quiet acknowledgement (no toast
 * stack, no modal) and the button stays put-to-rest after the call.
 *
 * The action is idempotent — clicking when nothing's stale returns
 * `nothing-stale` and the button surfaces a "Already up to date" hint.
 */
export function RefreshTranslationsButton({ slug }: { slug: string }) {
  const t = useTranslations('Restaurant')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    setStatus(null)
    setError(null)
    startTransition(async () => {
      let result: RefreshResult | { ok: false; reason: 'forbidden' }
      try {
        result = await refreshTranslationsAction(slug)
      } catch (err) {
        setError(t('refreshTranslationsError'))
        console.error('[menu-translation] action threw', err)
        return
      }
      if (result.ok) {
        setStatus(
          t('refreshTranslationsSuccess', {
            rows: result.staleRows,
            languages: result.targetLanguages.join(', ').toUpperCase(),
          }),
        )
        router.refresh()
        return
      }
      if (result.reason === 'no-targets') {
        setStatus(t('refreshTranslationsNoTargets'))
        return
      }
      if (result.reason === 'nothing-stale') {
        setStatus(t('refreshTranslationsUpToDate'))
        return
      }
      setError(t('refreshTranslationsError'))
    })
  }

  return (
    <div
      className="inline-flex flex-col items-end gap-0.5"
      data-test-id="refresh-translations"
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onClick}
        disabled={pending}
        data-test-id="refresh-translations-trigger"
      >
        {pending
          ? t('refreshTranslationsPending')
          : t('refreshTranslations')}
      </Button>
      {status && (
        <span
          className="text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink-55)] font-[family-name:var(--mono)]"
          data-test-id="refresh-translations-status"
        >
          {status}
        </span>
      )}
      {error && (
        <span
          className="text-[10.5px] text-[var(--cinnabar)]"
          data-test-id="refresh-translations-error"
        >
          {error}
        </span>
      )}
    </div>
  )
}
