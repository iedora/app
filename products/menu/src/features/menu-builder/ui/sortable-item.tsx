'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldInput,
  FieldLabel,
} from '@iedora/design-system'
import { ImageUpload } from '@/features/upload/ui/image-upload'
import { LocalizedFields } from '@/features/i18n/ui/localized-fields'
import type { LanguageCode, LocalizedText } from '@/features/i18n'
import { deleteItem, updateItem } from '../actions'
import type { BuilderItem, BuilderVariant } from './types'

type EditableVariant = {
  label: string
  /** Raw price string for the input; empty allowed mid-typing. */
  priceText: string
}

function variantsToEditable(
  variants: ReadonlyArray<BuilderVariant>,
): EditableVariant[] {
  return variants.map((v) => ({
    label: v.label,
    priceText: v.priceCents > 0 ? (v.priceCents / 100).toFixed(2) : '',
  }))
}

function parsePriceCents(raw: string): number {
  const n = Number(raw.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return NaN
  return Math.round(n * 100)
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

export function SortableItem({
  slug,
  restaurantId,
  defaultLanguage,
  supportedLanguages,
  item,
}: {
  slug: string
  restaurantId: string
  defaultLanguage: LanguageCode
  supportedLanguages: LanguageCode[]
  item: BuilderItem
}) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const [open, setOpen] = useState(false)
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description ?? '')
  // Maps of overrides keyed by language. Default language stays in `name`/
  // `description` above. The LocalizedFields component owns the active-tab UI.
  const [nameI18n, setNameI18n] = useState<LocalizedText>(() => item.nameI18n ?? {})
  const [descriptionI18n, setDescriptionI18n] = useState<LocalizedText>(
    () => item.descriptionI18n ?? {},
  )
  const [priceText, setPriceText] = useState((item.priceCents / 100).toFixed(2))
  const [available, setAvailable] = useState(item.available)
  const [variants, setVariants] = useState<EditableVariant[]>(() =>
    variantsToEditable(item.variants),
  )
  // Local mirror for immediate dialog feedback after upload — server already
  // persists; router.refresh() syncs the row preview when the dialog closes.
  const [imageUrl, setImageUrl] = useState<string | null>(item.imageUrl)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const priceCents = Math.round(Number(priceText.replace(',', '.')) * 100)
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError('Invalid price')
      return
    }

    // Variants: drop blank-label rows the operator may have added and
    // never filled. Reject any half-typed prices so we don't write
    // garbage. Empty array is a real action (clear all variants).
    const cleanedVariants: { label: string; priceCents: number }[] = []
    for (const v of variants) {
      const label = v.label.trim()
      if (label.length === 0) continue
      const priceCents = parsePriceCents(v.priceText)
      if (Number.isNaN(priceCents)) {
        setError(`Invalid price for variant "${label}"`)
        return
      }
      cleanedVariants.push({ label, priceCents })
    }

    startTransition(async () => {
      const res = await updateItem(slug, item.id, {
        name: name.trim(),
        description: description.trim(),
        priceCents,
        available,
        nameI18n,
        descriptionI18n,
        variants: cleanedVariants,
      })
      if (res && 'error' in res) {
        setError(res.error ?? 'Could not save')
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  function addVariant() {
    setVariants((prev) => [...prev, { label: '', priceText: '' }])
  }

  function patchVariant(idx: number, patch: Partial<EditableVariant>) {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  }

  function removeVariant(idx: number) {
    setVariants((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex items-center gap-3 px-3 py-2"
    >
      <button
        aria-label="Drag item"
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        ⋮⋮
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="flex flex-1 items-center justify-between gap-3 text-left">
            <div className="flex min-w-0 items-center gap-3">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  data-testid={`item-thumb-${item.id}`}
                  className="h-8 w-8 shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0">
                <div className={item.available ? '' : 'text-muted-foreground line-through'}>
                  {item.name}
                </div>
                {item.description && (
                  <div className="truncate text-xs text-muted-foreground">
                    {item.description}
                  </div>
                )}
                {item.variants.length > 0 && (
                  // Variant pills inline under the description. `flex-wrap`
                  // means 4+ doses just continue to a second row — no
                  // overflow, no layout break. Tabular-nums keeps prices
                  // aligned for quick visual scan.
                  <div
                    className="mt-1 flex flex-wrap items-center gap-1"
                    data-test-id={`item-variants-${item.id}`}
                  >
                    {item.variants.map((v, vi) => (
                      <span
                        key={`${v.label}-${vi}`}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--ink-14)] bg-[var(--paper-2)] px-2 py-0.5 text-[10.5px] text-[var(--ink-55)]"
                      >
                        <span>{v.label}</span>
                        <span className="text-[var(--ink-40)]">·</span>
                        <span className="tabular-nums">
                          {formatPrice(v.priceCents, item.currency)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="text-sm tabular-nums text-muted-foreground">
              {formatPrice(item.priceCents, item.currency)}
            </div>
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit item</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            <LocalizedFields
              id="item"
              defaultLanguage={defaultLanguage}
              supportedLanguages={supportedLanguages}
              name={name}
              onNameChange={setName}
              description={description}
              onDescriptionChange={setDescription}
              nameI18n={nameI18n}
              onNameI18nChange={setNameI18n}
              descriptionI18n={descriptionI18n}
              onDescriptionI18nChange={setDescriptionI18n}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor={`price-${item.id}`}>Price ({item.currency})</FieldLabel>
                <FieldInput
                  id={`price-${item.id}`}
                  inputMode="decimal"
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  required
                />
              </Field>
              <div className="flex items-end gap-2">
                <input
                  id={`avail-${item.id}`}
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  className="h-4 w-4"
                />
                <FieldLabel htmlFor={`avail-${item.id}`}>Available</FieldLabel>
              </div>
            </div>
            <Field>
              <FieldLabel>Photo</FieldLabel>
              <ImageUpload
                target={{ kind: 'item-photo', restaurantId, itemId: item.id }}
                currentUrl={imageUrl}
                label="Item photo"
                onChange={(url) => {
                  setImageUrl(url)
                  router.refresh()
                }}
              />
            </Field>

            {/* Variants editor. Some menus carry 3-4 prices per dish
                (Dose / Meia dose / Take-away / Cuvete) so the list is
                vertical and unbounded; each row stays self-contained
                (label + price + remove). The "Add variant" link sits
                at the bottom of the list. */}
            <Field>
              <FieldLabel>Variants (optional)</FieldLabel>
              <div
                className="space-y-2"
                data-test-id={`item-variants-edit-${item.id}`}
              >
                {variants.length === 0 ? (
                  <p className="text-xs text-[var(--ink-55)]">
                    No variants. Add one for sized doses (e.g. Meia dose) or
                    pour sizes (e.g. Imperial, Caneca).
                  </p>
                ) : (
                  variants.map((v, vi) => (
                    <div
                      key={vi}
                      className="flex items-center gap-2"
                      data-test-id={`item-variant-row-${item.id}-${vi}`}
                    >
                      <input
                        type="text"
                        value={v.label}
                        onChange={(e) =>
                          patchVariant(vi, { label: e.target.value })
                        }
                        placeholder="Label (e.g. Meia dose)"
                        aria-label="Variant label"
                        className="flex-1 min-w-0 rounded border border-[var(--ink-14)] bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--ink-40)]"
                        data-test-id={`item-variant-label-${item.id}-${vi}`}
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={v.priceText}
                        onChange={(e) =>
                          patchVariant(vi, { priceText: e.target.value })
                        }
                        placeholder="0.00"
                        aria-label={`Price for ${v.label || 'variant'}`}
                        className="w-24 rounded border border-[var(--ink-14)] bg-transparent px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-[var(--ink-40)]"
                        data-test-id={`item-variant-price-${item.id}-${vi}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeVariant(vi)}
                        aria-label="Remove variant"
                        title="Remove variant"
                        className="text-[var(--ink-40)] hover:text-[var(--cinnabar)] px-1 text-sm leading-none"
                        data-test-id={`item-variant-remove-${item.id}-${vi}`}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
                <button
                  type="button"
                  onClick={addVariant}
                  className="text-[10.5px] uppercase tracking-[0.18em] font-[family-name:var(--mono)] text-[var(--ink-40)] hover:text-[var(--ink)]"
                  data-test-id={`item-variant-add-${item.id}`}
                >
                  + Add variant
                </button>
              </div>
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="justify-between sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  startTransition(async () => {
                    await deleteItem(slug, item.id)
                    setOpen(false)
                    router.refresh()
                  })
                }
                disabled={pending}
              >
                Delete
              </Button>
              <Button type="submit" variant="solid" disabled={pending}>
                {pending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
