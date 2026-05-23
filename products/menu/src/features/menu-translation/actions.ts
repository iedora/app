'use server'

import { requireRestaurantBySlug } from '@/features/auth'
import { revalidateRestaurant } from '@/features/menu-publishing'
import { drizzleTranslationData } from './adapters/drizzle'
import { kimiTranslationAdapter } from './adapters/kimi'
import {
  refreshTranslations as runRefreshTranslations,
  type RefreshResult,
} from './use-cases/refresh-translations'

/**
 * One-click translation sync for a restaurant. Auth-gated by slug; only
 * rows whose `translations_synced_at` is older than `updated_at` (or
 * NULL) are sent to Kimi, keyed by the restaurant's
 * `supportedLanguages` minus `defaultLanguage`.
 *
 * Revalidates the restaurant cache tag on success so the public menu
 * picks up new languages on the next visit.
 */
export async function refreshTranslationsAction(
  slug: string,
): Promise<RefreshResult | { ok: false; reason: 'forbidden' }> {
  const { restaurant: r } = await requireRestaurantBySlug(slug)
  const result = await runRefreshTranslations(
    drizzleTranslationData,
    kimiTranslationAdapter,
    { restaurantId: r.id },
  )
  if (result.ok) revalidateRestaurant(slug)
  return result
}
