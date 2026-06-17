import { Hono } from "hono";

import type { AuditDeps } from "./deps";
import { eventsRoutes } from "./features/events/events.routes";

// Composition root: wires shared deps into each feature slice and mounts them.
// Business logic lives in features/<slice>/, never here. Exported (with its
// type) so the admin BFF can build a typed Hono RPC client.
export function buildApp(deps: AuditDeps) {
  const app = new Hono();

  app.get("/up", async (c) => {
    try {
      await deps.database.ping();
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false }, 503);
    }
  });

  app.route("/obs", eventsRoutes(deps));

  return app;
}

export type AuditApp = ReturnType<typeof buildApp>;
