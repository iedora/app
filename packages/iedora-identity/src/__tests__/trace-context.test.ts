import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import {
  context,
  propagation,
  trace,
  type Context,
  type TextMapPropagator,
} from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { createWebhookSender } from "../sender";
import { createWebhookReceiver } from "../receiver";
import { formatStripeStyleHeader, signSignedPayload } from "../signature";
import { SIGNATURE_HEADER } from "../events";
import type { WebhookSubscription } from "../types";

/**
 * Minimal W3C-shaped propagator written in the test so we don't need to
 * pull `@opentelemetry/core` into the package just for spec coverage.
 * Reads/writes the single `traceparent` field — sufficient to prove the
 * sender injects on outbound and the receiver extracts on inbound.
 *
 * Format mirrors the real W3C propagator: `00-<traceId>-<spanId>-<flags>`.
 */
const TRACEPARENT = "traceparent" as const;

class FakeTraceparentPropagator implements TextMapPropagator {
  inject(
    ctx: Context,
    carrier: unknown,
    setter: { set: (carrier: unknown, key: string, value: string) => void },
  ): void {
    // `getSpanContext` is the right read here: extracted contexts (the
    // receiver side) only ever carry the raw SpanContext, not a full Span.
    // `getSpan` would return undefined for those, and we'd silently emit
    // nothing on the next hop.
    const sc = trace.getSpanContext(ctx);
    if (!sc) return;
    setter.set(
      carrier,
      TRACEPARENT,
      `00-${sc.traceId}-${sc.spanId}-${sc.traceFlags.toString(16).padStart(2, "0")}`,
    );
  }

  extract(
    ctx: Context,
    carrier: unknown,
    getter: {
      get: (carrier: unknown, key: string) => string | string[] | undefined;
    },
  ): Context {
    const value = getter.get(carrier, TRACEPARENT);
    const headerValue = Array.isArray(value) ? value[0] : value;
    if (typeof headerValue !== "string") return ctx;
    const parts = headerValue.split("-");
    if (parts.length !== 4) return ctx;
    const [, traceId, spanId, flagsHex] = parts;
    if (!traceId || !spanId || !flagsHex) return ctx;
    return trace.setSpanContext(ctx, {
      traceId,
      spanId,
      traceFlags: Number.parseInt(flagsHex, 16),
      isRemote: true,
    });
  }

  fields(): string[] {
    return [TRACEPARENT];
  }
}

/** Synthetic SpanContext used for sender-side tests. */
const FAKE_SPAN_CONTEXT = {
  traceId: "0af7651916cd43dd8448eb211c80319c",
  spanId: "b7ad6b7169203331",
  traceFlags: 1,
  isRemote: false,
};

describe("trace context propagation", () => {
  const contextManager = new AsyncLocalStorageContextManager();

  beforeAll(() => {
    // Production wires both globals via @vercel/otel during register().
    // Tests have neither by default — propagation.inject would no-op and
    // context.with wouldn't actually activate the passed context. We
    // install minimal versions so the assertions reflect the real path.
    contextManager.enable();
    context.setGlobalContextManager(contextManager);
    propagation.setGlobalPropagator(new FakeTraceparentPropagator());
  });

  afterAll(() => {
    propagation.disable();
    context.disable();
    contextManager.disable();
  });

  it("sender injects traceparent when an active span context exists", async () => {
    const seenHeaders: Record<string, string>[] = [];
    const fetchFn = vi.fn(
      async (
        _input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => {
        seenHeaders.push(
          (init?.headers as Record<string, string> | undefined) ?? {},
        );
        return new Response("ok", { status: 200 });
      },
    );

    const subs: WebhookSubscription[] = [
      { url: "https://hooks.example.test/h", secret: "s" },
    ];
    const sender = createWebhookSender({
      listSubscriptions: async () => subs,
      fetch: fetchFn as unknown as typeof fetch,
      retries: { attempts: 1, backoffMs: () => 0 },
      allowPrivateNetworks: true,
    });

    // Active context with a known span — same shape genkan would have at
    // the moment of emit().
    const ctxWithSpan = trace.setSpanContext(context.active(), FAKE_SPAN_CONTEXT);
    await context.with(ctxWithSpan, () =>
      sender.emit({ event: "user.deleted", payload: { user_id: "u1" } }),
    );

    expect(seenHeaders).toHaveLength(1);
    const traceparent = seenHeaders[0]?.[TRACEPARENT];
    expect(traceparent).toBeDefined();
    expect(traceparent).toContain(FAKE_SPAN_CONTEXT.traceId);
  });

  it("sender omits traceparent when no active span context exists", async () => {
    const seenHeaders: Record<string, string>[] = [];
    const fetchFn = vi.fn(
      async (
        _input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => {
        seenHeaders.push(
          (init?.headers as Record<string, string> | undefined) ?? {},
        );
        return new Response("ok", { status: 200 });
      },
    );

    const sender = createWebhookSender({
      listSubscriptions: async () => [
        { url: "https://hooks.example.test/h", secret: "s" },
      ],
      fetch: fetchFn as unknown as typeof fetch,
      retries: { attempts: 1, backoffMs: () => 0 },
      allowPrivateNetworks: true,
    });

    // No `context.with(...)` — propagator's `getSpan(ctx)` returns
    // undefined and the no-op span never produces a header.
    await sender.emit({ event: "user.deleted", payload: { user_id: "u1" } });

    expect(seenHeaders).toHaveLength(1);
    expect(seenHeaders[0]?.[TRACEPARENT]).toBeUndefined();
  });

  it("preserves the same traceparent across retry attempts (sender)", async () => {
    // Real-world scenario: the subscriber's first attempt 503s, sender
    // retries; OO must show all attempts under the SAME trace so the
    // operator can see the retry sequence as siblings. A regression
    // where each attempt got a new trace would shatter the timeline.
    const seenTraceparents: (string | undefined)[] = [];
    let httpCalls = 0;
    const fetchFn = vi.fn(
      async (
        _input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => {
        httpCalls += 1;
        seenTraceparents.push(
          (init?.headers as Record<string, string> | undefined)?.[TRACEPARENT],
        );
        // 503 on the first two attempts → 200 on the third. Mirrors a
        // flaky downstream that eventually recovers.
        if (httpCalls <= 2) {
          return new Response("temporarily unavailable", { status: 503 });
        }
        return new Response("ok", { status: 200 });
      },
    );

    const sender = createWebhookSender({
      listSubscriptions: async () => [
        { url: "https://retry.example.test/h", secret: "s" },
      ],
      fetch: fetchFn as unknown as typeof fetch,
      retries: { attempts: 3, backoffMs: () => 0 },
      allowPrivateNetworks: true,
    });

    const ctxWithSpan = trace.setSpanContext(
      context.active(),
      FAKE_SPAN_CONTEXT,
    );
    await context.with(ctxWithSpan, () =>
      sender.emit({ event: "user.deleted", payload: { user_id: "u1" } }),
    );

    expect(seenTraceparents).toHaveLength(3);
    // Every attempt carried a traceparent referencing the same trace id.
    // The span id can vary if a future enhancement spawns a child span
    // per attempt; the trace id must NOT.
    for (const tp of seenTraceparents) {
      expect(tp, "every retry must carry a traceparent").toBeDefined();
      expect(tp).toContain(FAKE_SPAN_CONTEXT.traceId);
    }
  });

  it("stops carrying traceparent on terminal 4xx (no further attempts to verify the contract on)", async () => {
    // Documentation test: the sender treats 4xx as terminal (subscriber
    // rejected the payload, retrying is pointless). Critical that we
    // record the one traceparent we DID send so the failed-delivery span
    // in OO doesn't lose its parent linkage. Pins the "4xx is a single
    // attempt" path so a future refactor that adds 4xx retries doesn't
    // silently change behaviour.
    const seenTraceparents: (string | undefined)[] = [];
    const fetchFn = vi.fn(
      async (
        _input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => {
        seenTraceparents.push(
          (init?.headers as Record<string, string> | undefined)?.[TRACEPARENT],
        );
        return new Response("bad request", { status: 400 });
      },
    );

    const sender = createWebhookSender({
      listSubscriptions: async () => [
        { url: "https://nope.example.test/h", secret: "s" },
      ],
      fetch: fetchFn as unknown as typeof fetch,
      retries: { attempts: 5, backoffMs: () => 0 },
      allowPrivateNetworks: true,
    });

    const ctxWithSpan = trace.setSpanContext(
      context.active(),
      FAKE_SPAN_CONTEXT,
    );
    await context.with(ctxWithSpan, () =>
      sender.emit({ event: "user.deleted", payload: { user_id: "u1" } }),
    );

    // Exactly one attempt — 4xx is terminal.
    expect(seenTraceparents).toHaveLength(1);
    expect(seenTraceparents[0]).toContain(FAKE_SPAN_CONTEXT.traceId);
  });

  it("receiver runs the handler inside the extracted upstream context", async () => {
    const secret = "shared-secret";
    let observedTraceId: string | undefined;

    const receiver = createWebhookReceiver({
      secret,
      on: {
        "user.deleted": async () => {
          observedTraceId = trace.getSpan(context.active())?.spanContext().traceId;
        },
      },
    });

    const body = JSON.stringify({
      id: "evt_test_1",
      occurred_at: new Date().toISOString(),
      event: "user.deleted",
      payload: { user_id: "u1" },
    });
    const t = Date.now();
    const sig = formatStripeStyleHeader(
      t,
      signSignedPayload(secret, t, body),
    );

    const upstreamTraceparent = `00-${FAKE_SPAN_CONTEXT.traceId}-${FAKE_SPAN_CONTEXT.spanId}-01`;
    const req = new Request("https://r.example.test/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SIGNATURE_HEADER]: sig,
        [TRACEPARENT]: upstreamTraceparent,
      },
      body,
    });

    const res = await receiver.POST(req);
    expect(res.status).toBe(200);
    expect(observedTraceId).toBe(FAKE_SPAN_CONTEXT.traceId);
  });

  it("preserves the upstream trace context on the unknown-event path (warn + dedup write)", async () => {
    // Real-world scenario: genkan emits an event a consumer doesn't
    // have a handler for. The receiver still runs dedup bookkeeping and
    // logs a warning. With phase-3 logs queued (#11), THAT warning needs
    // a trace_id stamp; with the future "span-around-dedup-write"
    // possibility on the table, the dedup hooks need active context too.
    // Pin the contract: ALL post-validation work runs inside the
    // extracted upstream context.
    const secret = "shared-secret-unknown";
    let warnTraceId: string | undefined;
    let rememberTraceId: string | undefined;

    const consoleSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {
        warnTraceId = trace
          .getSpan(context.active())
          ?.spanContext().traceId;
      });

    // Custom dedup store whose `remember` reads the active context.
    const dedupStore = {
      async has(): Promise<boolean> {
        return false;
      },
      async remember(): Promise<void> {
        rememberTraceId = trace
          .getSpan(context.active())
          ?.spanContext().traceId;
      },
    };

    const receiver = createWebhookReceiver({
      secret,
      // No handler for user.deleted — triggers the unknown-event path.
      on: {},
      dedupStore,
    });

    const body = JSON.stringify({
      id: "evt_unknown_1",
      occurred_at: new Date().toISOString(),
      event: "user.deleted",
      payload: { user_id: "u1" },
    });
    const t = Date.now();
    const sig = formatStripeStyleHeader(
      t,
      signSignedPayload(secret, t, body),
    );

    const upstreamTraceparent = `00-${FAKE_SPAN_CONTEXT.traceId}-${FAKE_SPAN_CONTEXT.spanId}-01`;
    const req = new Request("https://r.example.test/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SIGNATURE_HEADER]: sig,
        [TRACEPARENT]: upstreamTraceparent,
      },
      body,
    });

    const res = await receiver.POST(req);
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledOnce();
    // Both side-effect paths saw the upstream trace.
    expect(warnTraceId).toBe(FAKE_SPAN_CONTEXT.traceId);
    expect(rememberTraceId).toBe(FAKE_SPAN_CONTEXT.traceId);

    consoleSpy.mockRestore();
  });

  it("preserves the upstream trace context on the dedup-hit fast path (replayed envelope)", async () => {
    // Real-world scenario: a webhook with the same envelope id arrives
    // again within the dedup window (sender retried before getting the
    // 200, network was slow). Receiver short-circuits to 200 without
    // calling the handler. Once spans are added around the dedup-check
    // (e.g. metrics for "how often do we dedup?"), they must stitch to
    // the upstream trace. Pin the contract end-to-end.
    const secret = "shared-secret-replay";
    let hasTraceId: string | undefined;

    const dedupStore = {
      async has(): Promise<boolean> {
        hasTraceId = trace.getSpan(context.active())?.spanContext().traceId;
        return true; // simulate "already seen"
      },
      async remember(): Promise<void> {},
    };

    const receiver = createWebhookReceiver({
      secret,
      on: {
        "user.deleted": async () => {
          // This MUST NOT run on the dedup-hit path. Surface a clear
          // failure mode if it does.
          throw new Error("handler should not have been called");
        },
      },
      dedupStore,
    });

    const body = JSON.stringify({
      id: "evt_replay_1",
      occurred_at: new Date().toISOString(),
      event: "user.deleted",
      payload: { user_id: "u1" },
    });
    const t = Date.now();
    const sig = formatStripeStyleHeader(
      t,
      signSignedPayload(secret, t, body),
    );

    const upstreamTraceparent = `00-${FAKE_SPAN_CONTEXT.traceId}-${FAKE_SPAN_CONTEXT.spanId}-01`;
    const req = new Request("https://r.example.test/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SIGNATURE_HEADER]: sig,
        [TRACEPARENT]: upstreamTraceparent,
      },
      body,
    });

    const res = await receiver.POST(req);
    expect(res.status).toBe(200);
    expect(hasTraceId).toBe(FAKE_SPAN_CONTEXT.traceId);
  });
});
