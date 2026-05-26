# Day 0 — Wipe everything (clean slate)

> Part of [docs/deploy.md](../deploy.md). Sibling guides: [Day 0](day-0.md) · [Day 1](day-1.md) · [Day 2](day-2.md) · [Troubleshooting](troubleshooting.md).


When the goal is a TRUE zero state — no cloud resources, no Tofu state,
nothing for the next deploy to inherit. Use this before a Day 1 from
scratch.

The operator needs `BWS_ACCESS_TOKEN` in their shell and `bws / tofu /
rclone / curl / jq` on PATH.

```bash
# 1. Tear down everything Tofu manages (VPS, DNS, Tunnel, R2 buckets,
#    R2 tokens, BWS IAC_* keys). Destroy-hooks purge each R2 bucket
#    via rclone before the API DELETE.
bin/iedora-env tofu -chdir=infra/iac/tofu init
bin/iedora-env tofu -chdir=infra/iac/tofu destroy -auto-approve

# If the Cloudflare tunnel DELETE 400s with "active connections", wait
# 2–3 min for the CF edge to drop the cloudflared connector and retry:
until bin/iedora-env tofu -chdir=infra/iac/tofu destroy -auto-approve; do sleep 30; done

# 2. Verify zero orphans (anything created outside Tofu's awareness).
bin/iedora-env bash -c '
  curl -fsS -H "Authorization: Bearer $IAC_BOOTSTRAP_HCLOUD_TOKEN" \
    https://api.hetzner.cloud/v1/servers | jq -r ".servers[] | .name"
  ZONE=$(curl -fsS -H "Authorization: Bearer $IAC_BOOTSTRAP_CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/zones?name=iedora.com" | jq -r ".result[0].id")
  curl -fsS -H "Authorization: Bearer $IAC_BOOTSTRAP_CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
    | jq -r ".result[] | \"\(.type) \(.name)\""
  curl -fsS -H "Authorization: Bearer $IAC_BOOTSTRAP_CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel?is_deleted=false" \
    | jq -r ".result[] | .name"
'
# Expect: nothing iedora-shaped. The `iedora-tofu-state` R2 bucket and
# `iedora-tofu-state-r2` CF token survive — they're Stage -1 (next step).
```

**Optional — Day 0 deep**: nuke the Stage -1 state bucket + scoped
token too. After this, the next deploy MUST re-run
`bin/state-bucket-bootstrap` (which is otherwise idempotent and a fast
no-op on warm runs).

```bash
bin/iedora-env bash -c '
  TOKEN="$IAC_BOOTSTRAP_CLOUDFLARE_API_TOKEN"
  # Revoke the R2-scoped state token.
  TID=$(curl -fsS -H "Authorization: Bearer $TOKEN" "https://api.cloudflare.com/client/v4/user/tokens?per_page=50" \
        | jq -r ".result[] | select(.name==\"iedora-tofu-state-r2\") | .id")
  [ -n "$TID" ] && curl -fsS -X DELETE -H "Authorization: Bearer $TOKEN" \
    "https://api.cloudflare.com/client/v4/user/tokens/$TID" >/dev/null
  # Delete the state bucket.
  curl -fsS -X DELETE -H "Authorization: Bearer $TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets/iedora-tofu-state" >/dev/null
  # Drop the BWS keys that pointed at them.
  for K in IAC_BOOTSTRAP_TOFU_STATE_ACCESS_KEY IAC_BOOTSTRAP_TOFU_STATE_SECRET_KEY IAC_BOOTSTRAP_TOFU_STATE_BUCKET; do
    ID=$(bws secret list "$BWS_PROJECT_ID" -o json | jq -r ".[] | select(.key==\"$K\") | .id")
    [ -n "$ID" ] && bws secret delete "$ID"
  done
'
```

**What survives Day 0** (operator-managed `IAC_BOOTSTRAP_*` in BWS):
`CLOUDFLARE_API_TOKEN`, `STATE_PASSPHRASE`, `HCLOUD_TOKEN`,
`GHCR_TOKEN`, `SSH_PRIVATE_KEY`, `OPENOBSERVE_ROOT_USER_EMAIL`. Plus
the GH Actions secret `BWS_ACCESS_TOKEN`. These are the seven things
you NEVER want Tofu to manage; everything else is Tofu-minted on
Day 1.

