import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-SHA256, hex-encoded. The signature is computed over the **exact raw
 * body bytes** the sender wrote on the wire — never a re-serialized JSON
 * (key order is not stable).
 */
export function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/**
 * Verify a header value against a body. Accepts the header in either
 *   - `sha256=<hex>` form (GitHub / Stripe convention), or
 *   - bare `<hex>` form.
 *
 * Returns false on any malformed input — never throws — so the receiver
 * can map straight to a 401. The compare itself is constant-time.
 */
export function verifySignature(
  secret: string,
  body: string,
  header: string | null | undefined,
): boolean {
  if (typeof header !== "string" || header.length === 0) return false;

  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  if (!/^[0-9a-fA-F]+$/.test(provided)) return false;

  const expected = signPayload(secret, body);
  // Lengths must match before timingSafeEqual; mismatch is a tampered
  // signature regardless of content.
  if (provided.length !== expected.length) return false;

  try {
    const a = Buffer.from(provided.toLowerCase(), "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Format a hex digest into the `sha256=<hex>` header convention. */
export function formatSignatureHeader(digestHex: string): string {
  return `sha256=${digestHex}`;
}
