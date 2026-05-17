import { describe, expect, it, vi } from "vitest";
import { createWebhookSender } from "../sender";
import { SIGNATURE_HEADER } from "../events";
import { verifySignature } from "../signature";
import type { DeliveryResult, WebhookSubscription } from "../types";

function fakeFetch(
  impl: (req: { url: string; body: string; signature: string }) => Response,
) {
  return vi.fn(
    async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const body = typeof init?.body === "string" ? init.body : "";
      const headers = init?.headers as Record<string, string> | undefined;
      const signature = headers?.[SIGNATURE_HEADER] ?? "";
      return impl({ url, body, signature });
    },
  );
}

const NO_BACKOFF = { attempts: 3, backoffMs: () => 0 };

describe("sender", () => {
  it("signs the body with each subscription's secret", async () => {
    const subs: WebhookSubscription[] = [
      { url: "https://a.test/hook", secret: "secret-a" },
      { url: "https://b.test/hook", secret: "secret-b" },
    ];
    const seen: { url: string; body: string; signature: string }[] = [];
    const fetchFn = fakeFetch(({ url, body, signature }) => {
      seen.push({ url, body, signature });
      return new Response("ok", { status: 200 });
    });

    const sender = createWebhookSender({
      listSubscriptions: async () => subs,
      fetch: fetchFn as unknown as typeof fetch,
      retries: NO_BACKOFF,
    });

    await sender.emit({
      event: "user.deleted",
      payload: { user_id: "u1" },
    });

    expect(seen).toHaveLength(2);
    for (const s of seen) {
      const sub = subs.find((x) => x.url === s.url);
      expect(sub).toBeDefined();
      expect(verifySignature(sub!.secret, s.body, s.signature)).toBe(true);
      // Same body to every subscriber — only the signature differs.
      const parsed = JSON.parse(s.body);
      expect(parsed.event).toBe("user.deleted");
      expect(parsed.payload.user_id).toBe("u1");
      expect(typeof parsed.id).toBe("string");
      expect(typeof parsed.occurred_at).toBe("string");
    }
  });

  it("retries on 5xx and succeeds on a later attempt", async () => {
    let calls = 0;
    const fetchFn = fakeFetch(() => {
      calls++;
      return new Response("server error", {
        status: calls < 3 ? 503 : 200,
      });
    });
    const results: DeliveryResult[] = [];
    const sender = createWebhookSender({
      listSubscriptions: async () => [
        { url: "https://x.test/hook", secret: "s" },
      ],
      fetch: fetchFn as unknown as typeof fetch,
      retries: NO_BACKOFF,
      onDelivery: (r) => results.push(r),
    });

    await sender.emit({ event: "user.deleted", payload: { user_id: "u1" } });

    expect(calls).toBe(3);
    expect(results.map((r) => r.status)).toEqual(["failed", "failed", "ok"]);
    expect(results[2]?.attempt).toBe(3);
  });

  it("does NOT retry on 4xx", async () => {
    let calls = 0;
    const fetchFn = fakeFetch(() => {
      calls++;
      return new Response("nope", { status: 400 });
    });
    const results: DeliveryResult[] = [];
    const sender = createWebhookSender({
      listSubscriptions: async () => [
        { url: "https://x.test/hook", secret: "s" },
      ],
      fetch: fetchFn as unknown as typeof fetch,
      retries: NO_BACKOFF,
      onDelivery: (r) => results.push(r),
    });

    await sender.emit({ event: "user.deleted", payload: { user_id: "u1" } });

    expect(calls).toBe(1);
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("failed");
    expect(results[0]?.http).toBe(400);
  });

  it("retries on network error then succeeds", async () => {
    let calls = 0;
    const fetchFn = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error("ECONNRESET");
      return new Response("ok", { status: 200 });
    });
    const results: DeliveryResult[] = [];
    const sender = createWebhookSender({
      listSubscriptions: async () => [
        { url: "https://x.test/hook", secret: "s" },
      ],
      fetch: fetchFn as unknown as typeof fetch,
      retries: NO_BACKOFF,
      onDelivery: (r) => results.push(r),
    });

    await sender.emit({ event: "user.deleted", payload: { user_id: "u1" } });

    expect(calls).toBe(2);
    expect(results.map((r) => r.status)).toEqual(["failed", "ok"]);
  });

  it("respects the allow-list when set", async () => {
    const fetchFn = fakeFetch(() => new Response("ok", { status: 200 }));
    const sender = createWebhookSender({
      listSubscriptions: async () => [
        // Subscribed only to user.* events.
        {
          url: "https://x.test/hook",
          secret: "s",
          events: ["user.deleted", "user.banned"],
        },
        // Subscribed to everything (no allow-list).
        { url: "https://y.test/hook", secret: "s" },
      ],
      fetch: fetchFn as unknown as typeof fetch,
      retries: NO_BACKOFF,
    });

    // Off-list event: only the everything-subscriber gets it.
    await sender.emit({
      event: "org.deleted",
      payload: { org_id: "o1" },
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const firstCall = fetchFn.mock.calls[0]?.[0];
    expect(firstCall).toBe("https://y.test/hook");

    // On-list event: both subscribers get it.
    fetchFn.mockClear();
    await sender.emit({
      event: "user.deleted",
      payload: { user_id: "u1" },
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("treats an empty events array as 'nothing'", async () => {
    const fetchFn = fakeFetch(() => new Response("ok", { status: 200 }));
    const sender = createWebhookSender({
      listSubscriptions: async () => [
        { url: "https://x.test/hook", secret: "s", events: [] },
      ],
      fetch: fetchFn as unknown as typeof fetch,
      retries: NO_BACKOFF,
    });

    await sender.emit({ event: "user.deleted", payload: { user_id: "u1" } });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
