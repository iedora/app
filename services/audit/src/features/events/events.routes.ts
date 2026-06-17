import { auditFilter } from "@iedora/contracts";
import { serviceAuth } from "@iedora/server-kit";
import { Hono } from "hono";

import type { AuditDeps } from "../../deps";
import { queryAudit } from "./events.query";

// Vertical slice: querying the audit log. Owns its route, its request
// validation, and its data access (events.query) — everything for this feature
// in one place. Mounted at /obs by the app composition root.
export function eventsRoutes(deps: AuditDeps) {
  return new Hono().get("/events", serviceAuth(deps.verifier), async (c) => {
    const parsed = auditFilter.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: "invalid query" }, 400);
    return c.json(await queryAudit(deps.database.db, parsed.data));
  });
}
