/**
 * Event tags exposed in the webhook admin dialogs. Mirrors the
 * `IdentityEvent` union in `@iedora/identity`. If you add an event there,
 * add it here too — there's no derivation pulling them automatically.
 */
export const KNOWN_IDENTITY_EVENTS = [
  'user.banned',
  'user.unbanned',
  'user.deleted',
  'user.role_changed',
  'org.created',
  'org.updated',
  'org.deleted',
  'org.member_added',
  'org.member_removed',
  'org.member_role_changed',
  'grant.revoked',
] as const

export type KnownIdentityEvent = (typeof KNOWN_IDENTITY_EVENTS)[number]
