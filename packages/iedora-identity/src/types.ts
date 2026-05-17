import type { IdentityEventName, IdentityEventOf } from "./events";

/**
 * One subscriber's destination. Persisted in genkan's `webhook_subscription`
 * table; the sender reads it through a port at delivery time.
 */
export type WebhookSubscription = {
  /** Absolute HTTPS URL — the subscriber's POST endpoint. */
  url: string;
  /** Shared HMAC secret. Both sides sign/verify with it. */
  secret: string;
  /**
   * Optional event allow-list. If absent, the subscriber receives every
   * event in the union. Empty array means "nothing" — explicit opt-out.
   */
  events?: IdentityEventName[];
};

/**
 * Telemetry for one delivery attempt. The sender invokes
 * `opts.onDelivery` with this so callers can log / persist to an outbox.
 */
export type DeliveryResult = {
  url: string;
  event: IdentityEventName;
  attempt: number;
  status: "ok" | "failed";
  http?: number;
  error?: string;
};

/**
 * Type-safe handler map for the receiver. Each entry is keyed by the event
 * tag and typed by the matching payload. Handlers are async-or-sync.
 */
export type HandlerMap = {
  [K in IdentityEventName]: (
    payload: IdentityEventOf<K>,
  ) => void | Promise<void>;
};
