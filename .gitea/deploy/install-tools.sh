#!/usr/bin/env bash
# Restore-or-install deploy tools (docker-buildx + bws + kamal gem).
#
# Idempotente: cada tool só descarrega se a versão actual no cache diferir
# da pinned. Cache persiste entre runs via bind-mount /var/cache/deploy-tools
# → /opt/deploy-bin no container (declarado no workflow caller, whitelistado
# em homelab-core-infra/gitea-runner-config.yaml valid_volumes).
#
# Cold start ~60s (apt deps + 3 tools). Steady-state ~30s (apt deps only —
# `ruby`/`build-essential`/`docker.io` apt continuam fresh por design;
# tools binaries são reutilizados do volume).
#
# Variáveis pinned:
#   KAMAL_VERSION    default 2.11.0
#   BUILDX_VERSION   default 0.34.1
#   BWS_VERSION      default 0.5.0

set -euo pipefail

KAMAL_VERSION="${KAMAL_VERSION:-2.11.0}"
BUILDX_VERSION="${BUILDX_VERSION:-0.34.1}"
BWS_VERSION="${BWS_VERSION:-0.5.0}"

CACHE=/opt/deploy-bin
mkdir -p "$CACHE" "$CACHE/gems"

# 1. apt deps. `ruby-dev` + `build-essential` são para gem ed25519
#    (extensão C nativa) compilar; `docker.io` traz o cli (buildx vem
#    em separado, ver passo 2).
if ! command -v ruby >/dev/null || ! command -v gcc >/dev/null; then
  echo "→ apt install: ruby + toolchain + docker-cli + jq/python3/curl/unzip"
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends \
    ca-certificates curl unzip jq python3 \
    ruby ruby-dev build-essential \
    docker.io
fi

# 2. Docker buildx plugin — apt's docker.io não traz.
need_buildx() {
  [ ! -x "$CACHE/docker-buildx" ] && return 0
  local have
  have=$("$CACHE/docker-buildx" version 2>/dev/null | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1 | sed 's/^v//')
  [ "$have" != "$BUILDX_VERSION" ]
}
if need_buildx; then
  echo "→ download buildx $BUILDX_VERSION"
  curl -fsSL "https://github.com/docker/buildx/releases/download/v${BUILDX_VERSION}/buildx-v${BUILDX_VERSION}.linux-amd64" \
    -o "$CACHE/docker-buildx"
  chmod +x "$CACHE/docker-buildx"
fi
mkdir -p "$HOME/.docker/cli-plugins"
cp "$CACHE/docker-buildx" "$HOME/.docker/cli-plugins/docker-buildx"

# 3. BWS CLI.
need_bws() {
  [ ! -x "$CACHE/bws" ] && return 0
  local have
  have=$("$CACHE/bws" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  [ "$have" != "$BWS_VERSION" ]
}
if need_bws; then
  echo "→ download bws $BWS_VERSION"
  curl -fsSL "https://github.com/bitwarden/sdk-sm/releases/download/bws-v${BWS_VERSION}/bws-x86_64-unknown-linux-gnu-${BWS_VERSION}.zip" -o /tmp/bws.zip
  unzip -q -o /tmp/bws.zip -d /tmp/bws-extract
  cp /tmp/bws-extract/bws "$CACHE/bws"
  chmod +x "$CACHE/bws"
  rm -rf /tmp/bws.zip /tmp/bws-extract
fi
install -m 0755 "$CACHE/bws" /usr/local/bin/bws

# 4. Kamal gem. GEM_HOME aponta para o volume — re-runs reusam gems
#    instalados + dependências transitivas (ed25519 compilado uma vez).
export GEM_HOME="$CACHE/gems"
export PATH="$GEM_HOME/bin:$PATH"
if ! kamal version 2>/dev/null | grep -q "$KAMAL_VERSION"; then
  echo "→ gem install kamal $KAMAL_VERSION"
  gem install --no-document kamal -v "$KAMAL_VERSION"
fi

# Propaga GEM_HOME + PATH para os steps seguintes do workflow.
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "GEM_HOME=$GEM_HOME" >> "$GITHUB_ENV"
fi
if [ -n "${GITHUB_PATH:-}" ]; then
  echo "$GEM_HOME/bin" >> "$GITHUB_PATH"
fi

echo "✓ deploy tools ready: buildx $($CACHE/docker-buildx version | head -1), bws $($CACHE/bws --version), kamal $(kamal version)"
