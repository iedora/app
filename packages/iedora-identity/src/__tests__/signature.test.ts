import { describe, expect, it } from "vitest";
import {
  formatSignatureHeader,
  signPayload,
  verifySignature,
} from "../signature";

const SECRET = "test-secret-x-32chars-or-whatever";
const BODY = '{"event":"user.deleted","payload":{"user_id":"u1"}}';

describe("signature", () => {
  it("round-trips: sign → verify", () => {
    const sig = formatSignatureHeader(signPayload(SECRET, BODY));
    expect(verifySignature(SECRET, BODY, sig)).toBe(true);
  });

  it("accepts bare hex without the sha256= prefix", () => {
    const hex = signPayload(SECRET, BODY);
    expect(verifySignature(SECRET, BODY, hex)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = formatSignatureHeader(signPayload(SECRET, BODY));
    expect(verifySignature(SECRET, BODY + " ", sig)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const sig = formatSignatureHeader(signPayload(SECRET, BODY));
    expect(verifySignature("different-secret", BODY, sig)).toBe(false);
  });

  it("rejects a missing or empty header", () => {
    expect(verifySignature(SECRET, BODY, null)).toBe(false);
    expect(verifySignature(SECRET, BODY, undefined)).toBe(false);
    expect(verifySignature(SECRET, BODY, "")).toBe(false);
  });

  it("rejects a malformed header (non-hex)", () => {
    expect(verifySignature(SECRET, BODY, "sha256=not-hex!!")).toBe(false);
    expect(verifySignature(SECRET, BODY, "sha256=")).toBe(false);
  });

  it("rejects a hex-but-wrong-length header without crashing", () => {
    expect(verifySignature(SECRET, BODY, "sha256=abcdef")).toBe(false);
  });

  it("is case-insensitive on the hex digest", () => {
    const hex = signPayload(SECRET, BODY);
    expect(verifySignature(SECRET, BODY, `sha256=${hex.toUpperCase()}`)).toBe(
      true,
    );
  });
});
