/**
 * Turn a Zod issue into plain, human English for surfaces that render issue
 * messages DIRECTLY to a user (the admin JSON-import Problems panel, the
 * onboarding form). Zod v4's defaults are developer-facing and leak internals:
 *   "Invalid input: expected string, received undefined"
 *   "Too small: expected array to have >=1 items"
 * This maps the common codes to clean copy and passes through any message that
 * was already given a custom string. (The translated Conform auth forms use
 * i18n message KEYS instead — see products/menu/.../auth/schemas.ts.)
 */

type ZodIssueLike = {
  code: string
  message: string
  expected?: unknown
  origin?: unknown
  minimum?: unknown
  maximum?: unknown
}

const TYPE_LABEL: Record<string, string> = {
  string: 'text',
  int: 'a whole number',
  number: 'a number',
  bigint: 'a whole number',
  boolean: 'true or false',
  array: 'a list',
  object: 'an object',
  date: 'a date',
}

const count = (n: unknown, unit: string): string => {
  const v = Number(n)
  return `${v} ${unit}${v === 1 ? '' : 's'}`
}

export function friendlyZodMessage(issue: ZodIssueLike): string {
  const origin = typeof issue.origin === 'string' ? issue.origin : undefined
  switch (issue.code) {
    case 'invalid_type': {
      const expected = typeof issue.expected === 'string' ? issue.expected : undefined
      return `Expected ${(expected && TYPE_LABEL[expected]) ?? expected ?? 'a valid value'}.`
    }
    case 'too_small':
      if (origin === 'array') return `Add at least ${count(issue.minimum, 'item')}.`
      if (origin === 'string') return `Must be at least ${count(issue.minimum, 'character')}.`
      return `Must be at least ${Number(issue.minimum)}.`
    case 'too_big':
      if (origin === 'array') return `At most ${count(issue.maximum, 'item')} allowed.`
      if (origin === 'string') return `Must be at most ${count(issue.maximum, 'character')}.`
      return `Must be at most ${Number(issue.maximum)}.`
    default:
      // already-custom message (regex hints, refinements, i18n keys, etc.)
      return issue.message
  }
}
