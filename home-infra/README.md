# home-infra

Infra base do homelab. Services independentes do produto + setup
scripts. Iedora vive em `home-infra/iedora/` (próximo) e arranca
**depois** destes.

## Layout

```
home-infra/
  scripts/              # setup one-time (server novo / substituição)
    bootstrap.sh        # 1 comando — orquestra tudo abaixo
    cf-tunnel.sh        # CF tunnel + DNS (Mac → CF API)
    r2-bucket.sh        # R2 bucket + S3 creds
    beelink-setup.sh    # SSH → server: apt + kamal + bws + ssh + hosts + clone
  <service>/            # services do dia-a-dia
    bin.sh              # idempotent, zero flags
    .env                # COMMITTED, config hardcoded non-secret
    docker-compose.yml
    scripts/            # auxiliares per-service (vazio por agora)
```

## 1 comando para server novo

```bash
export BWS_ACCESS_TOKEN='...'
export HOMELAB_HOST='ssh://root@192.168.50.53'
export IEDORA_GIT_PAT='...'        # PAT scope read:repository (gerar 1x em Gitea)

./home-infra/scripts/bootstrap.sh
```

`bootstrap.sh` corre em ordem (idempotent):

1. `cf-tunnel.sh` — CF tunnel + DNS, grava `IEDORA_TUNNEL_TOKEN` em BWS
2. `r2-bucket.sh` — R2 bucket + S3 creds em BWS
3. `beelink-setup.sh` — apt deps, Kamal gem, BWS CLI, SSH loopback key,
   `/etc/hosts` override, `/root/.netrc`, `/opt/iedora` git clone
4. `openobserve/bin.sh` — boot OpenObserve
5. `gitea/bin.sh` — boot Gitea + Caddy + runner

Pós-bootstrap (1ª vez):
- Criar admin Gitea (UI wizard OU `docker exec gitea gitea admin user create --admin ...`)
- Push da source iedora para o repo Gitea
- Primeiro `kamal setup -d production` via CI ou `./bin/deploy`

## Dia-a-dia (services)

Operations normais — reiniciar ou actualizar um service:

```bash
export BWS_ACCESS_TOKEN='...'

DOCKER_HOST=ssh://root@192.168.50.53 ./home-infra/openobserve/bin.sh
DOCKER_HOST=ssh://root@192.168.50.53 ./home-infra/gitea/bin.sh
```

`bin.sh` (idêntico em todos os services):

```bash
#!/usr/bin/env bash
set -euo pipefail
: "${BWS_ACCESS_TOKEN:?must be set}"
docker network inspect homelab-core >/dev/null 2>&1 || docker network create homelab-core
cd "$(dirname "${BASH_SOURCE[0]}")"
exec bws run -- docker compose up -d
```

## Config vs Secret

| | Onde | Visibilidade | Exemplo |
|---|---|---|---|
| **Config** (hardcoded) | `home-infra/<service>/.env` (committed) | público no repo | `ZO_ROOT_USER_EMAIL`, `GITEA_DOMAIN` |
| **Secret** (sensível) | Bitwarden Secrets (BWS) | injectado em runtime via `bws run` | `OPENOBSERVE_ADMIN_PASSWORD`, `CLOUDFLARE_API_TOKEN` |

Composes referenciam `${KEY}` — `compose` resolve via shell env (`bws
run`-injected) + `.env` file (next to compose). Nome do `${KEY}` no
compose == nome da key no BWS (para secrets) ou no `.env` (para config).

## Boot order

1. `home-infra/openobserve`
2. `home-infra/gitea`
3. *Depois*: `home-infra/iedora` (consumer, próxima migração)

Ordem entre os dois primeiros é livre (sem `depends_on` cross-compose).

## Services

| Service | Conteúdo | Portas | BWS keys |
|---|---|---|---|
| `openobserve/` | OpenObserve | 5080 (UI/OTLP HTTP), 5081 (OTLP gRPC) | `OPENOBSERVE_ADMIN_PASSWORD` |
| `gitea/` | Gitea (git/UI/Actions/registry) + Caddy (TLS `git.iedora.com` via CF DNS-01) + Actions runner | 3030 (UI), 3022 (SSH), 4443 (HTTPS Caddy) | `CLOUDFLARE_API_TOKEN` |

## Volumes & migração

Volumes referenciam os nomes da config anterior
(`homelab-core-infra_*`) via `external: true` — preserva dados.

Para homelab **novo**: apagar os blocos `external: true`; compose cria
volumes com o seu próprio prefix (`home-infra-gitea_*`).

Para migrar da config antiga (`homelab-core-infra/docker-compose.yml`)
para esta:

```bash
# Stop dos containers antigos (volumes mantêm-se):
DOCKER_HOST=ssh://root@192.168.50.53 \
  docker compose -f homelab-core-infra/docker-compose.yml --profile extras down

# Boot da config nova:
DOCKER_HOST=ssh://root@192.168.50.53 ./home-infra/openobserve/bin.sh
DOCKER_HOST=ssh://root@192.168.50.53 ./home-infra/gitea/bin.sh
```

`homelab-core-infra/` + `infra-bootstrap/` desaparecem quando a
migração do iedora terminar (próxima sessão).
