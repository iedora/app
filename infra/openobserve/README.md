# OpenObserve dashboards — version-controlled

Three pre-built dashboards that match the metrics emitted by
`@iedora/observability` and the manual spans in `products/menu/`. Push
them to the production OO instance via `apply-dashboards`.

```
infra/openobserve/
├── README.md
├── bin/
│   └── apply-dashboards     idempotent push (curl + jq, no TF provider needed)
└── dashboards/
    ├── business.json        adoption KPIs — views, languages, new orgs, top tenants
    ├── technical.json       latency SLIs + error rate + external-call health
    └── correlation.json     business × technical — who's affected, multi-service traces
```

## Apply

```bash
# From the repo root, against production:
bin/with-secrets infra/openobserve/bin/apply-dashboards

# Against a local OpenObserve (handy when iterating on JSON):
OO_BASE_URL=http://localhost:5080 \
  INFRA_OPENOBSERVE_ROOT_USER_EMAIL=local@iedora.com \
  AUTOGEN_INFRA_OPENOBSERVE_ROOT_USER_PASSWORD=local-dev-only \
  infra/openobserve/bin/apply-dashboards
```

The script is idempotent: matches existing dashboards by `title`, GETs
the current `hash`, PUTs to overwrite. New titles get POSTed.

## What's in each dashboard

| Dashboard | What it shows | When to look |
|---|---|---|
| **Business** | Views (24h / 30d), active restaurants (7d), new orgs (7d), top-10 tenants by views, language distribution | Monday morning, weekly review, demo prep |
| **Technical** | HTTP p95 by route, 5xx error rate, active requests, Zitadel call p95/failures, snapshot-loader bimodal, S3 op p95, rate-limit denies | Paging on-call, post-deploy verification |
| **Correlation** | p95 latency by tenant, errors by tenant, views vs p95 scatter, Zitadel cascade, recent multi-service traces | After a customer complaint, after a Zitadel restart, anytime business + technical signals need joining |

## Editing

1. Edit the JSON file (`business.json` / `technical.json` / `correlation.json`).
2. Run `apply-dashboards` — the matching dashboard is overwritten in place.
3. Commit the file. The OO state is now versioned in git.

The schema is **v5** (the version that ships with `openobserve:v0.80.3`).
Key references when editing:

- `web/src/utils/rum/errors.json` in the openobserve/openobserve repo — a
  complete production fixture worth reading.
- `src/config/src/meta/dashboards/v5/mod.rs` at the same tag — the Rust
  schema that defines every field.
- API: `POST /api/{org}/dashboards?folder={folder}` (create) and
  `PUT /api/{org}/dashboards/{id}?folder={folder}&hash={hash}` (update).
  Both authenticate via HTTP Basic with the OO root user.

## Cardinality notes

OpenObserve normalizes dotted attribute keys to underscored column names:

| OTel attribute | OO column |
|---|---|
| `tenant.restaurant_id` | `tenant_restaurant_id` |
| `service.name` | `service_name` |
| `iedora.zitadel.endpoint` | (filter via `attributes.iedora_zitadel_endpoint` on metrics, `iedora_zitadel_endpoint` on traces) |

All three dashboards use the underscored form. If a panel comes up
empty after a metric rename, that's the first place to check.
