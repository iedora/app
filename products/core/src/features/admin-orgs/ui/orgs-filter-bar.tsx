'use client'

import { useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Field,
  FieldLabel,
  FieldInput,
  Button,
} from '@iedora/design-system'

export function OrgsFilterBar({ defaults }: { defaults: { q?: string } }) {
  const t = useTranslations('Core.admin.orgs.filters')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function submit(form: FormData) {
    const params = new URLSearchParams(searchParams)
    const q = (form.get('q') as string) ?? ''
    if (q) params.set('q', q)
    else params.delete('q')
    params.delete('page')
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname
    startTransition(() => router.replace(next, { scroll: false }))
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        submit(new FormData(e.currentTarget))
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      data-test-id="admin-orgs-filter-bar"
    >
      <Field className="flex-1">
        <FieldLabel htmlFor="q">{t('queryLabel')}</FieldLabel>
        <FieldInput
          id="q"
          name="q"
          type="search"
          defaultValue={defaults.q ?? ''}
          placeholder={t('queryPlaceholder')}
          data-test-id="admin-orgs-filter-q"
          inputMode="search"
          autoComplete="off"
        />
      </Field>
      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        data-test-id="admin-orgs-filter-submit"
      >
        {pending ? t('applying') : t('apply')}
      </Button>
    </form>
  )
}
