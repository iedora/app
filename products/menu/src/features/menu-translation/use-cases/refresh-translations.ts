import 'server-only'
import type { LanguageCode } from '@/features/i18n'
import type {
  StaleRow,
  TranslatableField,
  TranslationDataPort,
  TranslationPort,
  WriteUpdate,
} from '../ports'

export type RefreshResult =
  | { ok: true; staleRows: number; translatedFields: number; targetLanguages: LanguageCode[] }
  | { ok: false; reason: 'no-targets' | 'nothing-stale'; staleRows: number }

/**
 * Smart sync — translate only the rows whose source text has changed
 * since the last `translations_synced_at`. Targets are the restaurant's
 * `supportedLanguages` minus its `defaultLanguage`. No-ops cleanly
 * when there are no targets or no stale rows.
 *
 *   1. Load restaurant language config + stale rows
 *   2. Project each row's `name` and `description` (when present) into
 *      a flat list of `TranslatableField`s, tagged with the source row
 *   3. Call the AI port once per target language (parallelised in the
 *      adapter) to translate every field
 *   4. Rebuild the i18n maps (existing + new translations merged) and
 *      hand them to the data port in a single transaction that also
 *      bumps `translations_synced_at`
 */
export async function refreshTranslations(
  data: TranslationDataPort,
  translator: TranslationPort,
  input: { restaurantId: string },
): Promise<RefreshResult> {
  const { defaultLanguage, supportedLanguages } =
    await data.getRestaurantLanguageConfig(input.restaurantId)

  const targets = supportedLanguages.filter((l) => l !== defaultLanguage)
  if (targets.length === 0) {
    return { ok: false, reason: 'no-targets', staleRows: 0 }
  }

  const stale = await data.findStale(input.restaurantId)
  if (stale.length === 0) {
    return { ok: false, reason: 'nothing-stale', staleRows: 0 }
  }

  const fields: TranslatableField[] = []
  for (const row of stale) {
    fields.push({
      rowKind: row.rowKind,
      id: row.id,
      field: 'name',
      text: row.name,
    })
    if (row.description && row.description.trim().length > 0) {
      fields.push({
        rowKind: row.rowKind,
        id: row.id,
        field: 'description',
        text: row.description,
      })
    }
  }

  const translated = await translator.translate({
    fromLanguage: defaultLanguage,
    toLanguages: targets,
    fields,
  })

  // Rebuild i18n maps row-by-row. Merge new translations into the
  // existing override map so that languages NOT in this sync (rare —
  // would mean supportedLanguages changed between reads) survive.
  const byRow = new Map<string, StaleRow>()
  for (const row of stale) byRow.set(`${row.rowKind}:${row.id}`, row)

  const merged = new Map<string, WriteUpdate>()
  function ensure(key: string, row: StaleRow): WriteUpdate {
    const existing = merged.get(key)
    if (existing) return existing
    const fresh: WriteUpdate = {
      rowKind: row.rowKind,
      id: row.id,
      nameI18n: row.nameI18n ?? {},
      descriptionI18n: row.descriptionI18n ?? {},
    }
    merged.set(key, fresh)
    return fresh
  }

  for (const t of translated) {
    const key = `${t.rowKind}:${t.id}`
    const row = byRow.get(key)
    if (!row) continue // defensive — translator can't invent ids
    const update = ensure(key, row)
    const targetMap =
      t.field === 'name' ? update.nameI18n : update.descriptionI18n
    if (!targetMap) continue
    for (const lang of targets) {
      const value = t.translations[lang]
      if (typeof value === 'string' && value.length > 0) {
        targetMap[lang] = value
      }
    }
  }

  // Every stale row needs a `translations_synced_at` bump even when no
  // translations came back (means "we tried, source is current as of now").
  // Bring rows with no translations into the update set with their
  // existing i18n maps untouched.
  for (const row of stale) {
    ensure(`${row.rowKind}:${row.id}`, row)
  }

  // Normalise: empty i18n object → null on the column (keeps jsonb tidy).
  const updates: WriteUpdate[] = Array.from(merged.values()).map((u) => ({
    rowKind: u.rowKind,
    id: u.id,
    nameI18n:
      u.nameI18n && Object.keys(u.nameI18n).length > 0 ? u.nameI18n : null,
    descriptionI18n:
      u.descriptionI18n && Object.keys(u.descriptionI18n).length > 0
        ? u.descriptionI18n
        : null,
  }))

  await data.applyTranslations(input.restaurantId, updates)

  return {
    ok: true,
    staleRows: stale.length,
    translatedFields: fields.length,
    targetLanguages: targets,
  }
}
