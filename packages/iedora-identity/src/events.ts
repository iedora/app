/**
 * Source-of-truth event union for the iedora identity webhook system.
 *
 * Genkan (the IdP) emits these; first-party products consume them via the
 * receiver in this same package. Adding a new event = extending this union
 * here (the only place) — both sides pick it up via TS narrowing.
 *
 * Payload field names use snake_case so the wire form is friendly to the
 * non-TS consumers we expect (a future .NET API, a Go service). The TS
 * helpers `IdentityEventOf<E>` give back the strongly-typed payload for a
 * given event tag.
 */
export type IdentityEvent =
  | {
      event: "user.banned";
      payload: { user_id: string; reason?: string; expires?: string | null };
    }
  | { event: "user.unbanned"; payload: { user_id: string } }
  | { event: "user.deleted"; payload: { user_id: string } }
  | {
      event: "user.role_changed";
      payload: { user_id: string; role: string };
    }
  | {
      event: "org.created";
      payload: { org_id: string; slug: string; name: string };
    }
  | {
      event: "org.updated";
      payload: { org_id: string; slug?: string; name?: string };
    }
  | { event: "org.deleted"; payload: { org_id: string } }
  | {
      event: "org.member_added";
      payload: { org_id: string; user_id: string; role: string };
    }
  | {
      event: "org.member_removed";
      payload: { org_id: string; user_id: string };
    }
  | {
      event: "org.member_role_changed";
      payload: { org_id: string; user_id: string; role: string };
    }
  | {
      event: "grant.revoked";
      payload: { user_id: string; client_id: string };
    };

/** Tag-string of every event in the union. */
export type IdentityEventName = IdentityEvent["event"];

/** Pull the payload type for a given event tag. */
export type IdentityEventOf<E extends IdentityEventName> = Extract<
  IdentityEvent,
  { event: E }
>["payload"];

/**
 * The exact JSON shape genkan POSTs to every subscriber. Receivers parse
 * this after verifying the signature — never the other way around.
 *
 * `id` is the de-duplication key; receivers MAY use it to short-circuit
 * retried deliveries, but the package itself does not (a beacon-style "at
 * least once" delivery is acceptable for our use cases).
 */
export type IdentityWebhookEnvelope = IdentityEvent & {
  /** Stable per-emission id, e.g. `evt_2026_05_17_abc123`. */
  id: string;
  /** ISO-8601 timestamp at emission time. */
  occurred_at: string;
};

/**
 * HTTP header carrying the HMAC-SHA256 signature. Lowercase per fetch /
 * Web Fetch API convention; senders MUST emit it on outgoing requests,
 * receivers MUST look it up case-insensitively.
 */
export const SIGNATURE_HEADER = "x-iedora-signature" as const;
