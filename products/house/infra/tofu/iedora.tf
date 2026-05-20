# House (iedora.com) — fully declarative Astro deploy on Cloudflare Workers
# Static Assets.
#
# Owns end-to-end: the Worker script, the static asset bundle (uploaded by
# Tofu via Cloudflare's `assets-upload-session` API since provider v5.11+),
# the custom domain at iedora.com, and the TLS cert / proxied DNS record
# the Workers API auto-creates under `cloudflare_workers_custom_domain`.
# No wrangler in the deploy path — `bun run build` → `tofu apply`.
#
# Why no narrow workload token any more:
#   The provider authenticates with the SAME bootstrap CF token Tofu uses
#   to mint everything else (passed in via TF_VAR_cloudflare_api_token).
#   Minting a derived shorter-scope token bought nothing in CI — it was
#   the parent token that exposed it anyway. One credential, two consumers,
#   both authenticated against the same audit trail in Cloudflare.

data "cloudflare_zone" "iedora" {
  filter = { name = var.zone_name }
}

# ── Worker + static assets ───────────────────────────────────────────────────
#
# `assets.directory` is a relative path on the operator's machine (or the
# CI runner). The provider scans the directory, computes per-file hashes,
# opens an `assets-upload-session` against Cloudflare, uploads each file
# (chunked, parallel), and binds the completion token to the script in
# one apply step. Subsequent applies skip unchanged files.
#
# Stub `content` is required because every Worker script must have a main
# module — even when assets serve directly (which they do by default when
# a request matches a file). The stub only runs on miss; the
# `not_found_handling = "404-page"` setting below makes Cloudflare serve
# `dist/404.html` directly without invoking the stub.

resource "cloudflare_workers_script" "house" {
  account_id  = var.account_id
  script_name = var.worker_name

  # Tiny inline module — the stub never executes in steady state because
  # `dist/404.html` exists and `not_found_handling = "404-page"` makes the
  # asset layer serve it directly. Kept as a defensive fallback if Astro
  # ever stops emitting a 404 page.
  content     = "export default { async fetch() { return new Response(null, { status: 404 }) } }"
  main_module = "worker.js"

  # Bump when adopting a newer Workers runtime; keeps deploys pinned to
  # known semantics. Same date convention as the rest of the iedora TF.
  compatibility_date = "2026-05-15"

  # Astro's static build output. Relative to this .tf file:
  #   infra/tofu/iedora.tf → ../../dist
  # CI (or `just house::deploy`) runs `bun run build` first.
  assets = {
    directory = "${path.module}/../../dist"
    config = {
      # Add a trailing slash to extensionless URLs. Matches Astro's
      # default routing.
      html_handling = "auto-trailing-slash"
      # Serve dist/404.html on miss. Astro emits it from 404.astro.
      not_found_handling = "404-page"
    }
  }
}

# ── Custom domain at the apex ────────────────────────────────────────────────
#
# Cloudflare's `workers_custom_domain` resource:
#   1. Creates a proxied AAAA DNS record at the apex (zone-level).
#   2. Issues + renews the TLS cert via Cloudflare's edge.
#   3. Binds requests for the hostname to the worker.
# Single declarative call, no separate `cloudflare_dns_record` needed.
#
# `environment` field is deprecated for assets-only scripts (cf TF
# provider issue #5618) — omitted intentionally.

resource "cloudflare_workers_custom_domain" "apex" {
  account_id = var.account_id
  zone_id    = data.cloudflare_zone.iedora.zone_id
  hostname   = var.zone_name
  service    = cloudflare_workers_script.house.script_name
}
