# @iedora/identity

Webhook surface for the iedora identity estate. Genkan (the IdP) emits typed
events; first-party products receive them, verify the HMAC-SHA256
signature, and act on them locally. Pattern is analogous to GitHub /
Stripe webhooks — same package, opposite ends.

## Surface

```ts
import {
  createWebhookSender,
  createWebhookReceiver,
  type IdentityEvent,
} from "@iedora/identity";
```

The `IdentityEvent` union is the source of truth — extending it here gives
both sides the new tag with type-narrowing for free.

## Sender (genkan)

```ts
// products/genkan/src/features/webhooks/sender.ts
import { createWebhookSender } from "@iedora/identity";
import { listSubscriptions } from "./adapters/drizzle";

const sender = createWebhookSender({ listSubscriptions });

export async function emit(event: IdentityEvent) {
  await sender.emit(event);
}
```

`emit()` signs the body per-subscriber, POSTs the envelope, retries on 5xx
and network errors, and gives up immediately on 4xx. `onDelivery` is the
observability seam.

## Receiver (menu, future products)

```ts
// products/menu/src/app/api/identity/webhook/route.ts
import { createWebhookReceiver } from "@iedora/identity";
import { db } from "@/shared/db/client";

const receiver = createWebhookReceiver({
  secret: process.env.IEDORA_IDENTITY_WEBHOOK_SECRET!,
  on: {
    "org.member_removed": async ({ org_id, user_id }) => {
      // Revoke local sessions, clear caches, etc.
    },
    "user.deleted": async ({ user_id }) => {
      // ...
    },
  },
});

export const POST = receiver.POST;
```

The handler map is partial — register only what the product cares about.
Unknown events get a 200 and a warn-line.

## Envelope

```json
{
  "id": "evt_2026_05_17_abc123",
  "event": "org.member_removed",
  "payload": { "org_id": "...", "user_id": "..." },
  "occurred_at": "2026-05-17T15:00:00.000Z"
}
```

Header `x-iedora-signature: sha256=<hmac_sha256_hex(secret, body)>` —
computed over the exact body bytes, never a re-serialized JSON (key order
isn't stable).
