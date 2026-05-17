import 'server-only'

/**
 * Public API of the webhooks slice. Genkan's auth instance hooks call
 * `emit()` after every relevant Better-Auth lifecycle event; the admin UI
 * uses the `list*` use-cases to manage subscribers.
 */
export { emit } from './sender'
export {
  listAdminSubscriptions,
  getSubscriptionById,
  type WebhookSubscriptionRow,
} from './use-cases/list-subscriptions'
