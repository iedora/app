// Client-side counterpart to serviceauth: a thin authed-fetch base for
// service-to-service GETs. Callers hold a ServiceClient (constructed from a
// base URL + a token source) so each endpoint method is one line instead of the
// repeated token() → fetch(Bearer) → !res.ok throw → json() boilerplate.

import { context, propagation } from "@iedora/observability";

/** Injects the W3C `traceparent` (+ baggage) so a service-to-service call
 *  continues the caller's trace — the Node OTel variant has no fetch
 *  auto-instrumentation, so we propagate by hand here. No-op until OTel is
 *  registered (no global propagator → nothing written). */
function withTrace(headers: Record<string, string>): Record<string, string> {
  propagation.inject(context.active(), headers, {
    set: (carrier, key, value) => {
      carrier[key] = value;
    },
  });
  return headers;
}

/** Anything that can mint/return a service bearer token (e.g. ServiceTokenSource). */
export interface TokenSource {
  token(): Promise<string>;
}

/** Thrown on a non-2xx service response. Carries the upstream `status` so a
 * caller can re-map it (e.g. surface auth's 422 as the BFF's 422 instead of a
 * blanket 500). */
export class ServiceClientError extends Error {
  constructor(
    service: string,
    path: string,
    readonly status: number,
  ) {
    super(`${service}: ${path} returned ${status}`);
    this.name = "ServiceClientError";
  }
}

export class ServiceClient {
  constructor(
    private readonly base: string,
    private readonly tokens: TokenSource,
    /** Service name, used in thrown error messages (e.g. "billing"). */
    private readonly name: string,
  ) {}

  /**
   * GET `path` with a Bearer token, parsing the JSON body as `T`. A status in
   * `allow` returns null instead of throwing (e.g. `[404]` to degrade a missing
   * resource to null); any other non-2xx throws. With no `allow` the result is
   * always `T` (non-2xx throws), so callers don't deal with null.
   */
  async get<T>(path: string): Promise<T>;
  async get<T>(path: string, allow: number[]): Promise<T | null>;
  async get<T>(path: string, allow: number[] = []): Promise<T | null> {
    const token = await this.tokens.token();
    const res = await fetch(`${this.base}${path}`, {
      headers: withTrace({ authorization: `Bearer ${token}` }),
    });
    if (allow.includes(res.status)) return null;
    if (!res.ok) throw new ServiceClientError(this.name, path, res.status);
    return (await res.json()) as T;
  }

  /** POST `body` as JSON with a Bearer token, parsing the JSON response as `T`.
   * Any non-2xx throws a {@link ServiceClientError} carrying the status. */
  async post<T>(path: string, body: unknown): Promise<T> {
    const token = await this.tokens.token();
    const res = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers: withTrace({ authorization: `Bearer ${token}`, "content-type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new ServiceClientError(this.name, path, res.status);
    return (await res.json()) as T;
  }
}
