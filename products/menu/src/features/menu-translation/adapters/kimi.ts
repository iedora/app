/**
 * Kimi (Moonshot) translation adapter — one structured call per target
 * language. We batch every field of a restaurant's stale rows into one
 * request per language: Kimi returns a JSON array of strings in the
 * same order as the input. Sending IDs back-and-forth would let the
 * model return out-of-order, but in practice OpenAI-compatible providers
 * preserve array order, and the JSON-array shape keeps the prompt tiny.
 *
 * If the model fails for a whole language we drop that language's
 * translations silently (the use-case writes whatever did come back;
 * the public menu's `localizedNullable()` falls back to the source).
 */
import 'server-only'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { LanguageCode } from '@/features/i18n'
import type { TranslationPort } from '../ports'

const KIMI_BASE_URL = 'https://api.moonshot.ai/v1'
// `kimi-k2.6` is the text-only flagship; vision isn't needed for
// translation. Sticks closer to the OpenAI Chat surface and is cheaper
// than the vision-preview model used by the menu-import adapter.
const KIMI_TEXT_MODEL = 'kimi-k2.6'

// Defensive cap. A typical 50-item menu sent in one batch produces ~5k
// output tokens (50 strings × ~80 tokens avg, generously). 8k buys
// headroom for verbose categories without truncating a payload mid-string.
const KIMI_MAX_OUTPUT_TOKENS = 8192

const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
  fr: 'French',
}

export function createKimiTranslationAdapter(
  options: { apiKey?: string } = {},
): TranslationPort {
  const apiKey = options.apiKey ?? process.env.KIMI_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    console.warn(
      '[menu-translation/kimi] KIMI_GENERATIVE_AI_API_KEY is missing; translation will fail at call time.',
    )
  }

  const client = createOpenAICompatible({
    name: 'kimi',
    baseURL: KIMI_BASE_URL,
    apiKey: apiKey ?? '',
  })
  const model = client(KIMI_TEXT_MODEL)

  async function translateOneLanguage(
    fromLanguage: LanguageCode,
    toLanguage: LanguageCode,
    texts: string[],
  ): Promise<string[]> {
    const Schema = z.object({
      translations: z
        .array(z.string())
        .describe(
          'Translated strings in the SAME ORDER as the input. One entry per ' +
            'input string. Preserve any units, punctuation, and currency ' +
            'symbols verbatim. Do not add quotes around translations.',
        ),
    })

    const numbered = texts
      .map((t, i) => `${i + 1}. ${t}`)
      .join('\n')

    const system = `You are a menu translator.
Translate every line of the input from ${LANGUAGE_LABELS[fromLanguage]} to ${LANGUAGE_LABELS[toLanguage]}.

Rules:
- Return EXACTLY ${texts.length} translations in the same order as the input.
- Preserve the meaning of culinary terms — use the most common name for
  a dish in the target language. For dishes without a target-language
  name (e.g. "Bacalhau à brás" in English), keep the original name
  unchanged.
- Preserve punctuation, capitalisation style, units ("0.5L", "33cl"),
  abbreviations ("p/2 pessoas"), and any printed dietary markers (v),
  (gf).
- Do not add quotes, line numbers, or commentary.
- Do not paraphrase or expand abbreviations.`

    try {
      const { object } = await generateObject({
        model,
        schema: Schema,
        system,
        temperature: 0,
        maxOutputTokens: KIMI_MAX_OUTPUT_TOKENS,
        prompt: `Translate these ${texts.length} strings:\n\n${numbered}`,
      })
      // Pad or truncate to the expected length so a misbehaving model
      // can't desync downstream indices.
      const result = [...object.translations]
      while (result.length < texts.length) result.push('')
      result.length = texts.length
      return result
    } catch (err) {
      console.error(
        `[menu-translation/kimi] ${fromLanguage}→${toLanguage} call failed`,
        err,
      )
      // Return empty strings so the use-case knows which ones missed.
      return texts.map(() => '')
    }
  }

  return {
    async translate({ fromLanguage, toLanguages, fields }) {
      if (fields.length === 0 || toLanguages.length === 0) return []

      const sourceTexts = fields.map((f) => f.text)
      // One request per target language, in parallel — the model itself
      // is stateless so we don't gain anything from a sequential chain.
      const perLanguage = await Promise.all(
        toLanguages.map(async (lang) => ({
          lang,
          texts: await translateOneLanguage(fromLanguage, lang, sourceTexts),
        })),
      )

      return fields.map((field, idx) => {
        const translations: Partial<Record<LanguageCode, string>> = {}
        for (const { lang, texts } of perLanguage) {
          const translated = texts[idx]
          // Drop empty translations so `localizedNullable()` falls back
          // to the source.
          if (translated && translated.trim().length > 0) {
            translations[lang] = translated.trim()
          }
        }
        return { ...field, translations }
      })
    },
  }
}

export const kimiTranslationAdapter = createKimiTranslationAdapter()
