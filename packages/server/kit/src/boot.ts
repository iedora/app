import { registerIedoraOtelNode, shutdownIedoraOtel } from "@iedora/observability";
import type { Hono } from "hono";

export interface ServeOptions {
  name: string;
  port: number;
  shutdownTimeoutMs?: number;
  /** Cleanup run during graceful shutdown — stop relays, close DB pools, etc. */
  onShutdown?: () => Promise<void> | void;
}

function log(msg: string, extra: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level: "info", msg, ...extra }));
}

/**
 * serve starts a Hono app under Bun.serve and wires SIGTERM/SIGINT graceful
 * shutdown: stop accepting connections + drain in-flight requests, run
 * onShutdown, then exit — bounded by a hard timeout. Accepts any Hono
 * regardless of its Env/Schema generics (an RPC-typed app carries a route
 * schema in its type).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serve(app: Hono<any, any, any>, opts: ServeOptions) {
  // OpenTelemetry (traces + metrics) for this service. The Node variant avoids
  // @vercel/otel (which misbehaves outside Next/under bun). It no-ops in tests
  // and when OTEL_EXPORTER_OTLP_ENDPOINT is unset, so this ships dark and is
  // switched on purely by setting that env — no code change to enable.
  registerIedoraOtelNode({ serviceName: opts.name });

  const server = Bun.serve({ port: opts.port, fetch: app.fetch });
  log("listening", { service: opts.name, port: opts.port });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log("shutting down", { service: opts.name, signal });
    const timer = setTimeout(() => process.exit(1), opts.shutdownTimeoutMs ?? 15_000);
    try {
      await server.stop();
      await opts.onShutdown?.();
      await shutdownIedoraOtel(); // flush any buffered spans/metrics before exit
    } finally {
      clearTimeout(timer);
      process.exit(0);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  return server;
}
