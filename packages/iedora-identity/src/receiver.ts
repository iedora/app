import {
  SIGNATURE_HEADER,
  type IdentityEvent,
  type IdentityEventName,
  type IdentityWebhookEnvelope,
} from "./events";
import { verifySignature } from "./signature";
import type { HandlerMap } from "./types";

export type ReceiverOptions<Handlers extends Partial<HandlerMap>> = {
  /** Shared HMAC secret. Same value the sender (genkan) was registered with. */
  secret: string;
  /**
   * Partial handler map — any event without a handler is ignored (logged
   * once if `warnOnUnknown` is true). This lets each product opt into the
   * subset it cares about.
   */
  on: Handlers;
  /** Default: true. Set false in tests to silence the console. */
  warnOnUnknown?: boolean;
};

type Receiver = {
  /**
   * Next.js App Router-shaped handler. Works in any runtime that supports
   * the Web Fetch API — Next, Workers, bare node:http with a fetch shim.
   */
  POST(req: Request): Promise<Response>;
};

function isIdentityEnvelope(value: unknown): value is IdentityWebhookEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.event === "string" &&
    typeof v.occurred_at === "string" &&
    typeof v.payload === "object" &&
    v.payload !== null
  );
}

/**
 * One receiver per product per signing secret. The product mounts it as a
 * Next 16 App Router POST handler under e.g. `/api/identity/webhook` and
 * Genkan delivers events to that URL.
 */
export function createWebhookReceiver<Handlers extends Partial<HandlerMap>>(
  opts: ReceiverOptions<Handlers>,
): Receiver {
  const warnOnUnknown = opts.warnOnUnknown ?? true;

  return {
    async POST(req: Request): Promise<Response> {
      // Read raw text first — the signature is over the exact bytes.
      // JSON.parse-then-stringify would lose key order.
      const body = await req.text();
      const header = req.headers.get(SIGNATURE_HEADER);

      if (!verifySignature(opts.secret, body, header)) {
        return new Response("invalid signature", { status: 401 });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        return new Response("malformed body", { status: 400 });
      }
      if (!isIdentityEnvelope(parsed)) {
        return new Response("malformed body", { status: 400 });
      }

      const eventName = parsed.event as IdentityEventName;
      // Single dynamic dispatch — index the handler map with the runtime
      // tag and call it with the matching payload. We widen to `unknown`
      // through a single cast because indexing a mapped type by a union
      // key narrows to the intersection of payloads (which is `never` for
      // disjoint payloads); the runtime correlation between `event` tag
      // and `payload` shape was already established by `isIdentityEnvelope`.
      const handler = (opts.on as Partial<HandlerMap>)[eventName] as
        | ((payload: unknown) => void | Promise<void>)
        | undefined;

      if (!handler) {
        if (warnOnUnknown) {
          // eslint-disable-next-line no-console
          console.warn(
            `[iedora-identity] no handler for event "${eventName}"; envelope id=${parsed.id}`,
          );
        }
        return new Response("ok", { status: 200 });
      }

      try {
        await handler((parsed as IdentityEvent).payload);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(
          `[iedora-identity] handler for "${eventName}" threw:`,
          e,
        );
        return new Response("handler error", { status: 500 });
      }

      return new Response("ok", { status: 200 });
    },
  };
}
