# Operations

Operational lifecycle for the iedora estate, split by phase. The
canonical architecture + pipeline + CI doc lives at
[`../deploy.md`](../deploy.md); these are the runbooks.

| | Read when |
|---|---|
| [**Day 0 — Wipe everything**](day-0.md) | You want a true zero state. Tear down cloud + state + BWS managed keys. Pre-condition for a clean Day 1. |
| [**Day 1 — Cold-start deploy**](day-1.md) | Empty cloud → working production. First-laptop bootstrap OR post-Day-0 redeploy. |
| [**Day 2 — Ongoing operations**](day-2.md) | Logs, psql, backup/restore, secret rotation, auth re-bootstrap. The longest section by mileage. |
| [**Troubleshooting**](troubleshooting.md) | Failure modes + recovery. Check here first when something is red. |

Every command assumes `BWS_ACCESS_TOKEN` is in your shell (operator)
or set as a GH Actions secret (CI). Everything else is hydrated by
[`bin/iedora-env`](../../bin/iedora-env).
