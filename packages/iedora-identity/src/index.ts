/**
 * @iedora/identity — shared webhook surface for the iedora estate.
 *
 *   genkan (the IdP)  ─emits→  this package's sender  ─POSTs→  consumers' receivers
 *
 * Same package, opposite ends. The `IdentityEvent` union is the source of
 * truth — both sides import it and the TS narrowing falls out for free.
 */

export {
  SIGNATURE_HEADER,
  type IdentityEvent,
  type IdentityEventName,
  type IdentityEventOf,
  type IdentityWebhookEnvelope,
} from "./events";

export {
  formatSignatureHeader,
  signPayload,
  verifySignature,
} from "./signature";

export { createWebhookSender, type SenderOptions } from "./sender";
export { createWebhookReceiver, type ReceiverOptions } from "./receiver";

export type {
  DeliveryResult,
  HandlerMap,
  WebhookSubscription,
} from "./types";
