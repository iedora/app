#!/usr/bin/env bash
# 1 comando para um homelab novo (ou substituição de server).
# Idempotent — pode correr múltiplas vezes sem efeito destrutivo.
#
# Pré-requisitos:
#   BWS_ACCESS_TOKEN  exportado
#   HOMELAB_HOST      ex: ssh://root@192.168.50.53
#   IEDORA_GIT_PAT    PAT scope read:repository (gerar 1x em git.iedora.com)
#
# Etapas:
#   1. CF tunnel + DNS (Mac→CF API)
#   2. R2 bucket + S3 creds (Mac→CF/R2 API)
#   3. Beelink: apt + ruby + kamal + bws + ssh-loopback + /etc/hosts +
#      /opt/iedora clone
#   4. Boot home-infra services (openobserve, gitea) via DOCKER_HOST=ssh
#
# Depois disto:
#   - Gitea precisa de admin user (criar via UI ou
#     `docker exec gitea gitea admin user create --admin`)
#   - Primeiro `kamal setup -d production` via CI (push a main) ou
#     `./bin/deploy` local

set -euo pipefail

: "${BWS_ACCESS_TOKEN:?must be set}"
: "${HOMELAB_HOST:?must be set, e.g. ssh://root@192.168.50.53}"
: "${IEDORA_GIT_PAT:?must be set (PAT scope read:repository)}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$HERE/.."
export HOMELAB_HOST DOCKER_HOST="$HOMELAB_HOST"

"$HERE/cf-tunnel.sh"
"$HERE/r2-bucket.sh"
"$HERE/beelink-setup.sh"

"$ROOT/openobserve/bin.sh"
"$ROOT/gitea/bin.sh"

echo
echo "✓ homelab pronto."
echo "  Próximo: criar gitea admin (UI ou docker exec) + primeiro deploy."
