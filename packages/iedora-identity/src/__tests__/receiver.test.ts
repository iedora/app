import { describe, expect, it, vi } from "vitest";
import { createWebhookReceiver } from "../receiver";
import { SIGNATURE_HEADER } from "../events";
import { formatSignatureHeader, signPayload } from "../signature";

const SECRET = "shared-test-secret";

function makeRequest(body: string, signature?: string): Request {
  return new Request("https://app.test/api/identity/webhook", {
    method: "POST",
    headers: signature
      ? { [SIGNATURE_HEADER]: signature, "content-type": "application/json" }
      : { "content-type": "application/json" },
    body,
  });
}

describe("receiver", () => {
  it("returns 200 and runs the handler on a valid signature", async () => {
    const onDeleted = vi.fn();
    const receiver = createWebhookReceiver({
      secret: SECRET,
      on: {
        "user.deleted": onDeleted,
      },
    });

    const body = JSON.stringify({
      id: "evt_1",
      event: "user.deleted",
      payload: { user_id: "u1" },
      occurred_at: "2026-05-17T00:00:00.000Z",
    });
    const sig = formatSignatureHeader(signPayload(SECRET, body));
    const res = await receiver.POST(makeRequest(body, sig));

    expect(res.status).toBe(200);
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(onDeleted).toHaveBeenCalledWith({ user_id: "u1" });
  });

  it("returns 401 on a bad signature", async () => {
    const onDeleted = vi.fn();
    const receiver = createWebhookReceiver({
      secret: SECRET,
      on: { "user.deleted": onDeleted },
    });

    const body = JSON.stringify({
      id: "evt_1",
      event: "user.deleted",
      payload: { user_id: "u1" },
      occurred_at: "2026-05-17T00:00:00.000Z",
    });
    const res = await receiver.POST(
      makeRequest(body, "sha256=" + "0".repeat(64)),
    );
    expect(res.status).toBe(401);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("returns 401 when the signature header is missing", async () => {
    const receiver = createWebhookReceiver({
      secret: SECRET,
      on: { "user.deleted": vi.fn() },
    });
    const body = "{}";
    const res = await receiver.POST(makeRequest(body));
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed JSON (even with a valid signature)", async () => {
    const receiver = createWebhookReceiver({
      secret: SECRET,
      on: { "user.deleted": vi.fn() },
    });
    const body = "not json";
    const sig = formatSignatureHeader(signPayload(SECRET, body));
    const res = await receiver.POST(makeRequest(body, sig));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the envelope is missing required fields", async () => {
    const receiver = createWebhookReceiver({
      secret: SECRET,
      on: { "user.deleted": vi.fn() },
    });
    const body = JSON.stringify({ event: "user.deleted" });
    const sig = formatSignatureHeader(signPayload(SECRET, body));
    const res = await receiver.POST(makeRequest(body, sig));
    expect(res.status).toBe(400);
  });

  it("returns 500 when the handler throws", async () => {
    const receiver = createWebhookReceiver({
      secret: SECRET,
      on: {
        "user.deleted": async () => {
          throw new Error("kaboom");
        },
      },
    });
    const body = JSON.stringify({
      id: "evt_1",
      event: "user.deleted",
      payload: { user_id: "u1" },
      occurred_at: "2026-05-17T00:00:00.000Z",
    });
    const sig = formatSignatureHeader(signPayload(SECRET, body));
    const res = await receiver.POST(makeRequest(body, sig));
    expect(res.status).toBe(500);
  });

  it("returns 200 on events without a registered handler (no-op)", async () => {
    const onDeleted = vi.fn();
    const receiver = createWebhookReceiver({
      secret: SECRET,
      on: { "user.deleted": onDeleted },
      warnOnUnknown: false,
    });
    const body = JSON.stringify({
      id: "evt_2",
      event: "org.created",
      payload: { org_id: "o1", slug: "acme", name: "Acme" },
      occurred_at: "2026-05-17T00:00:00.000Z",
    });
    const sig = formatSignatureHeader(signPayload(SECRET, body));
    const res = await receiver.POST(makeRequest(body, sig));
    expect(res.status).toBe(200);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("guards against the JSON.parse-then-stringify trap (key order)", async () => {
    // Two valid JSONs of the same envelope with different key order.
    const a =
      '{"id":"evt_1","event":"user.deleted","payload":{"user_id":"u1"},"occurred_at":"2026-05-17T00:00:00.000Z"}';
    const b =
      '{"event":"user.deleted","id":"evt_1","occurred_at":"2026-05-17T00:00:00.000Z","payload":{"user_id":"u1"}}';

    const onDeleted = vi.fn();
    const receiver = createWebhookReceiver({
      secret: SECRET,
      on: { "user.deleted": onDeleted },
    });

    const sigA = formatSignatureHeader(signPayload(SECRET, a));
    // sigA matches a, but NOT b — even though they parse to equal objects.
    const resA = await receiver.POST(makeRequest(a, sigA));
    expect(resA.status).toBe(200);
    const resB = await receiver.POST(makeRequest(b, sigA));
    expect(resB.status).toBe(401);
  });
});
