#!/usr/bin/env bash
# Idempotent CF Tunnel + DNS para o homelab. Cria (ou reutiliza) tunnel,
# configura ingress para os hostnames públicos, faz repoint dos CNAMEs,
# grava `IEDORA_TUNNEL_TOKEN` em BWS.
#
# Pré-requisitos:
#   - BWS_ACCESS_TOKEN exportado
#   - BWS key CLOUDFLARE_API_TOKEN com scope Tunnel + DNS
#   - Zone iedora.com activa na conta CF

set -euo pipefail

TUNNEL_NAME="${TUNNEL_NAME:-iedora-beelink}"
ZONE_NAME="${ZONE_NAME:-iedora.com}"
SERVICE_TARGET="${SERVICE_TARGET:-http://kamal-proxy:80}"
HOSTS=(iedora.com www.iedora.com menu.iedora.com core.iedora.com imopush.iedora.com)

: "${BWS_ACCESS_TOKEN:?BWS_ACCESS_TOKEN must be set}"

PROJECT_ID=$(bws project list -o json | jq -r '.[0].id')
CF_TOKEN=$(bws secret list "$PROJECT_ID" -o json | jq -r '.[]|select(.key=="CLOUDFLARE_API_TOKEN")|.value')
CF_ACCT=$(curl -sf -H "Authorization: Bearer $CF_TOKEN" 'https://api.cloudflare.com/client/v4/accounts' | jq -r '.result[0].id')
ZONE_ID=$(curl -sf -H "Authorization: Bearer $CF_TOKEN" "https://api.cloudflare.com/client/v4/zones?name=$ZONE_NAME" | jq -r '.result[0].id')

[ "$ZONE_ID" = "null" ] && { echo "Zone $ZONE_NAME não encontrada"; exit 1; }

EXISTING=$(curl -sf -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCT/cfd_tunnel?is_deleted=false" \
  | jq -r ".result[]|select(.name==\"$TUNNEL_NAME\")|.id" | head -1)

if [ -n "$EXISTING" ]; then
  TUNNEL_ID="$EXISTING"
  echo "  ✓ tunnel $TUNNEL_NAME existe ($TUNNEL_ID) — reutilizando"
  TUNNEL_TOKEN=$(curl -sS -H "Authorization: Bearer $CF_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CF_ACCT/cfd_tunnel/$TUNNEL_ID/token" | jq -r '.result // empty')
  [ -z "$TUNNEL_TOKEN" ] && { echo "Falhou a obter token do tunnel existente"; exit 1; }
else
  echo "  → criar tunnel $TUNNEL_NAME"
  TUNNEL_SECRET=$(openssl rand -base64 32)
  RESP=$(curl -sS -X POST -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/accounts/$CF_ACCT/cfd_tunnel" \
    -d "{\"name\":\"$TUNNEL_NAME\",\"tunnel_secret\":\"$TUNNEL_SECRET\",\"config_src\":\"cloudflare\"}")
  TUNNEL_ID=$(echo "$RESP" | jq -r '.result.id // empty')
  TUNNEL_TOKEN=$(echo "$RESP" | jq -r '.result.token // empty')
  [ -z "$TUNNEL_ID" ] && { echo "Falhou: $RESP"; exit 1; }
fi

# Ingress idempotent (PUT overwrites).
INGRESS='['
for H in "${HOSTS[@]}"; do
  INGRESS+="{\"hostname\":\"$H\",\"service\":\"$SERVICE_TARGET\"},"
done
INGRESS+='{"service":"http_status:404"}]'
curl -sS -X PUT -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCT/cfd_tunnel/$TUNNEL_ID/configurations" \
  -d "{\"config\":{\"ingress\":$INGRESS}}" | jq -c '{ingress: .success}'

# DNS records (create or update — idempotent).
TARGET="$TUNNEL_ID.cfargotunnel.com"
for NAME in "${HOSTS[@]}"; do
  REC=$(curl -sf -H "Authorization: Bearer $CF_TOKEN" "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$NAME" | jq -r '.result[0]')
  REC_ID=$(echo "$REC" | jq -r '.id')
  if [ "$REC_ID" = "null" ] || [ -z "$REC_ID" ]; then
    curl -sf -X POST -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
      "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
      -d "{\"type\":\"CNAME\",\"name\":\"$NAME\",\"content\":\"$TARGET\",\"proxied\":true}" >/dev/null
  else
    curl -sf -X PUT -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
      "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$REC_ID" \
      -d "{\"type\":\"CNAME\",\"name\":\"$NAME\",\"content\":\"$TARGET\",\"proxied\":true}" >/dev/null
  fi
done

# Persist token in BWS (idempotent — only edits if value differs).
EXISTING_SEC=$(bws secret list "$PROJECT_ID" -o json | jq -r '.[]|select(.key=="IEDORA_TUNNEL_TOKEN")|.id' | head -1)
if [ -n "$EXISTING_SEC" ]; then
  CURRENT_VAL=$(bws secret get "$EXISTING_SEC" -o json | jq -r '.value')
  [ "$CURRENT_VAL" = "$TUNNEL_TOKEN" ] || bws secret edit "$EXISTING_SEC" --value "$TUNNEL_TOKEN" >/dev/null
else
  bws secret create IEDORA_TUNNEL_TOKEN "$TUNNEL_TOKEN" "$PROJECT_ID" >/dev/null
fi

echo "✓ cf-tunnel"
