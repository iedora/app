#!/usr/bin/env bash
# Idempotent server-side bootstrap (Beelink). Tudo via SSH ao
# `HOMELAB_HOST`. Cobre:
#   1. APT deps (ruby+dev, build, git, curl, unzip, jq)
#   2. Kamal gem
#   3. BWS CLI
#   4. SSH loopback keypair em /root/.ssh/ci_ed25519 + authorized_keys
#   5. /etc/hosts override (git.iedora.com → 127.0.0.1, builder local)
#   6. /root/.netrc para git auth + /opt/iedora git clone
#
# Pré-requisitos:
#   HOMELAB_HOST     ex: ssh://root@192.168.50.53
#   GITEA_USER       ex: eduvhc
#   IEDORA_GIT_PAT   PAT do GITEA_USER com scope read:repository
#                    (criar uma vez em git.iedora.com/user/settings/applications)
#   REPO             ex: eduvhc/iedora

set -euo pipefail

: "${HOMELAB_HOST:?HOMELAB_HOST must be set (e.g. ssh://root@192.168.50.53)}"
: "${IEDORA_GIT_PAT:?IEDORA_GIT_PAT must be set (PAT scope read:repository)}"

KAMAL_VERSION="${KAMAL_VERSION:-2.11.0}"
BWS_VERSION="${BWS_VERSION:-0.5.0}"
GITEA_USER="${GITEA_USER:-eduvhc}"
REPO="${REPO:-eduvhc/iedora}"
SSH_TARGET="${HOMELAB_HOST#ssh://}"

echo "→ beelink-setup ($SSH_TARGET)"

# shellcheck disable=SC2087  # env vars expanded client-side, intencional
ssh "$SSH_TARGET" bash <<REMOTE
set -euo pipefail

# 1. APT deps
if ! command -v gem >/dev/null || ! command -v gcc >/dev/null || ! command -v git >/dev/null || ! command -v jq >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends \
    ca-certificates curl unzip jq ruby ruby-dev build-essential git
fi

# 2. Kamal gem
if ! gem list -i kamal -v '$KAMAL_VERSION' >/dev/null 2>&1; then
  gem install --no-document kamal -v '$KAMAL_VERSION'
fi

# 3. BWS CLI
if ! command -v bws >/dev/null || ! bws --version 2>&1 | grep -q '$BWS_VERSION'; then
  curl -fsSL "https://github.com/bitwarden/sdk-sm/releases/download/bws-v${BWS_VERSION}/bws-x86_64-unknown-linux-gnu-${BWS_VERSION}.zip" -o /tmp/bws.zip
  unzip -q -o /tmp/bws.zip -d /tmp/bws
  install -m 0755 /tmp/bws/bws /usr/local/bin/bws
  rm -rf /tmp/bws /tmp/bws.zip
fi

# 4. SSH loopback keypair
mkdir -p /root/.ssh && chmod 700 /root/.ssh
[ -d /root/.ssh/ci_ed25519 ] && rm -rf /root/.ssh/ci_ed25519
[ -f /root/.ssh/ci_ed25519 ] || ssh-keygen -t ed25519 -f /root/.ssh/ci_ed25519 -N "" -C "iedora-loopback-ci" -q
chmod 600 /root/.ssh/ci_ed25519
PUB=\$(cat /root/.ssh/ci_ed25519.pub)
touch /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys
grep -qxF "\$PUB" /root/.ssh/authorized_keys || echo "\$PUB" >> /root/.ssh/authorized_keys

# 5. /etc/hosts override
grep -qxF '127.0.0.1 git.iedora.com' /etc/hosts || echo '127.0.0.1 git.iedora.com' >> /etc/hosts

# 6. /root/.netrc + /opt/iedora clone (idempotent)
cat > /root/.netrc <<NETRC
machine git.iedora.com
login $GITEA_USER
password $IEDORA_GIT_PAT
NETRC
chmod 600 /root/.netrc
if [ -d /opt/iedora/.git ]; then
  cd /opt/iedora && git fetch origin --prune
else
  rm -rf /opt/iedora
  git clone https://git.iedora.com:4443/$REPO.git /opt/iedora
fi
REMOTE

echo "✓ beelink-setup"
