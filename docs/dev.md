# Dev local

## Quick start

```bash
bun install                     # uma vez
bun run dev:up                  # postgres + s3mock
bun run dev:migrate             # criar schema nas DBs locais
bun run dev                     # next dev em :3000
```

Tudo lê `dev/local.env` (tracked, sem secrets). Não precisas de
criar nenhum `.env` à mão.

## Serviços

| Serviço | Container | Porta |
|---------|-----------|-------|
| postgres | infra-postgres | 5432 |
| s3mock | infra-s3mock | 9090 |

O `dev/docker-compose.yml` monta `config/postgres/init.sql` que cria
as databases `menu`, `core` e `imopush`.

## .env

`dev/local.env` (tracked) é a única fonte para dev — DB URLs, S3,
better-auth, NEXT_PUBLIC_*. Para overrides locais (apontar para
serviços remotos, etc.) cria `dev/local.env.override` e exporta
manualmente, ou usa `apps/web/.env.local` (gitignored, ganha
prioridade sobre o que `bun --env-file` injectou).

## Comandos

```bash
bun run dev:up                  # Boot postgres + s3mock
bun run dev:down                # Stop
bun run dev:reset               # Apaga volumes (perde dados)
bun run dev:logs                # Logs
bun run dev:migrate             # Corre migrations
bun run typecheck               # TS check em todos os workspaces
bun run lint                    # ESLint em todos
bun run test                    # Vitest em todos
```

## Git & push

Setup canonical (SSH auto + commit signing + Conventional Commits) em
[git.md](git.md). Inclui instruções macOS/Linux **e Windows** (Git Bash
+ PowerShell).
