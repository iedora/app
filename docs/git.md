# Git & Gitea — commit / push canonical

Setup para empurrar para `git.iedora.com` (Gitea self-hosted no homelab)
**de qualquer rede** (casa, café, 4G) e em **qualquer um dos 3 laptops**
sem copiar ficheiros entre máquinas.

Stack:

- **Bitwarden Desktop SSH Agent** — chave SSH vive no vault encriptado,
  sincroniza entre laptops. Usada para **commit signing**.
- **HTTPS para transporte git** via Cloudflare Tunnel (`git.iedora.com`).
  PAT no keychain do OS (que tu mantéis em backup no vault).
- **Hooks** (pre-commit + commit-msg) instalados pelo `bun install`.

```
┌─ Bitwarden vault (sync 3 laptops) ─┐
│  SSH key (signing)  +  Gitea PAT   │
└────────────────────────────────────┘
       │                  │
       ▼                  ▼
   ssh-agent          OS keychain
   (signing)          (git push HTTPS)
       │                  │
       ▼                  ▼
   git commit -S     git push gitea
```

Workflow assumido: **trunk-based**. Pushes ao `main` disparam CI. PRs
opcionais quando se quer revisão explícita.

> **macOS — atalho automatizado**: `bun run setup:mac` (corre
> `scripts/setup-laptop-mac.sh`). Faz tudo nas secções 2-6 por ti;
> só precisas dos 3 cliques na UI do Bitwarden Desktop (§ 1).

---

## 1. Bitwarden Desktop — SSH Agent

Em **cada laptop**:

1. **Instala Bitwarden Desktop**
   - macOS: `brew install --cask bitwarden` (ou App Store)
   - Linux: `.deb` / `.AppImage` / `flatpak install com.bitwarden.desktop`
   - Windows: instalador `.exe` ou Microsoft Store

2. **Settings → Security → SSH Agent → Enable**

3. **Adiciona a chave SSH ao vault** (uma vez, primeiro laptop):
   - `+ Add Item → SSH Key → Generate`
   - Nome: `iedora-gitea`
   - Copia a public key

4. **Regista a public key no Gitea** (uma vez):
   - https://git.iedora.com/user/settings/keys
   - **Add SSH Key**, nome: `bitwarden-vault`, cola a public key
   - Marca como **Authentication** e **Signing** (Gitea usa a mesma key
     para os dois)

Nos restantes laptops, basta enable SSH Agent — o vault sincroniza.

### Socket paths por OS

| OS | Install | Path |
|---|---|---|
| macOS | App Store | `~/Library/Containers/com.bitwarden.desktop/Data/.bitwarden-ssh-agent.sock` |
| macOS | .dmg / brew | `~/.bitwarden-ssh-agent.sock` |
| Linux | standard | `~/.bitwarden-ssh-agent.sock` |
| Linux | snap | `~/snap/bitwarden/current/.bitwarden-ssh-agent.sock` |
| Linux | flatpak | `~/.var/app/com.bitwarden.desktop/data/.bitwarden-ssh-agent.sock` |
| Windows | qualquer | `\\.\pipe\openssh-ssh-agent` (desliga o OpenSSH Authentication Agent service primeiro) |

### Shell config

**macOS / Linux** — appende ao `~/.zshrc` (zsh) ou `~/.bashrc` (bash):

```bash
# Bitwarden SSH Agent — vault sincroniza chaves entre laptops
BW_SSH_SOCK="$HOME/Library/Containers/com.bitwarden.desktop/Data/.bitwarden-ssh-agent.sock"
# ↑ ajusta path conforme tabela acima
[ -S "$BW_SSH_SOCK" ] && export SSH_AUTH_SOCK="$BW_SSH_SOCK"
unset BW_SSH_SOCK
```

Recarrega: `source ~/.zshrc`. Verifica: `ssh-add -l` deve listar a key.

**Windows (PowerShell — Admin uma vez)**:

```powershell
Stop-Service ssh-agent
Set-Service ssh-agent -StartupType Disabled
# Bitwarden assume o pipe OpenSSH; nenhum env var necessário.
```

---

## 2. Commit signing (Bitwarden assina)

Em **cada laptop**, uma vez:

```bash
git config --global commit.gpgsign true
git config --global gpg.format ssh
git config --global user.signingkey 'key::ssh-ed25519 AAAA…'   # cola a public key

# allowed_signers — `git log --show-signature` verifica localmente
EMAIL=$(git config --global user.email)
PUB='ssh-ed25519 AAAA…'   # mesma key
echo "$EMAIL namespaces=\"git\" $PUB" >> ~/.ssh/allowed_signers
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers
```

Bitwarden Desktop tem de estar **aberto e unlocked** para assinar.

Verifica: `git log --show-signature -1` deve dizer
`Good "git" signature for eduardoferdcarvalho@gmail.com`.

---

## 3. HTTPS transport + Gitea PAT

### Remote

```bash
git remote set-url gitea https://git.iedora.com/eduvhc/iedora.git
```

### Credential helper (cache do PAT no OS)

| OS | Comando |
|---|---|
| macOS | `git config --global credential.helper osxkeychain` |
| Linux | `git config --global credential.helper libsecret` |
| Windows | `git config --global credential.helper manager` (Git Credential Manager — built-in com Git for Windows) |

### Gera o PAT (uma vez)

1. https://git.iedora.com/user/settings/applications
2. **Generate New Token**, scopes: `repository: read+write`
3. Copia o token, **guarda no Bitwarden vault** (Secure Note:
   `iedora-gitea-pat`)
4. Primeira push pede `Username: eduvhc` e `Password: <PAT>` — o
   keychain cacheia automaticamente

Em **laptop novo**: o vault tem o PAT, cola na prompt da 1ª push, OS
guarda.

### Rotação

A cada 6-12 meses regenera no Gitea + atualiza vault + invalida cache:

```bash
echo "url=https://git.iedora.com" | git credential reject
# Próxima push pede credenciais novas
```

---

## 4. Hooks (auto-instalados)

`bun install` na raiz copia:

- `scripts/git-hooks/pre-commit` → `actionlint` em ficheiros de
  `.gitea/workflows/` alterados.
- `scripts/git-hooks/commit-msg` → valida o subject contra Conventional
  Commits.

Funciona em macOS/Linux/Windows (Git Bash — vem com Git for Windows).
Bypass de emergência: `git commit --no-verify`.

### Conventional Commits — formato

```
<type>(<scope>)?!?: <subject ≤ 72 chars>
```

Types: `feat fix perf docs refactor test chore ci build style`.

Exemplos:

```
fix(ci): vitest 5 beta workaround for Bun __esModule bug
feat(menu)!: drop legacy slug API
chore: bump deps
```

---

## 5. Push flow (dia-a-dia, qualquer laptop, qualquer rede)

```bash
git checkout -b fix/something
# ... edits ...
git add -A
git commit -m "fix(scope): mensagem"   # commit-msg valida; Bitwarden assina
git push gitea fix/something            # HTTPS via Cloudflare; keychain → PAT
```

Trunk-based (push direto ao main):

```bash
git checkout main
git pull --rebase gitea main
git commit -m "..."
git push gitea main
```

Criar PR via API (não há `gh` para Gitea):

```bash
curl -X POST -u eduvhc:$(security find-generic-password -s git.iedora.com -w) \
  -H "Content-Type: application/json" \
  -d '{"title":"fix: something","head":"fix/something","base":"main"}' \
  https://git.iedora.com/api/v1/repos/eduvhc/iedora/pulls
```

---

## 6. Onboarding novo laptop

1. Instala Git, Bun, Bitwarden Desktop
2. Login no Bitwarden, **Enable SSH Agent** em Settings
3. Appende `SSH_AUTH_SOCK` ao shell rc (§ 1)
4. `git config --global` para signing (§ 2) e credential.helper (§ 3)
5. `git clone https://git.iedora.com/eduvhc/iedora.git`
6. `cd iedora && bun install`   (instala hooks)
7. Primeira push: cola PAT do vault na prompt

---

## 7. Troubleshooting

**`ssh-add -l` diz "The agent has no identities".** Bitwarden Desktop
fechado, SSH Agent não está enabled em Settings, ou `SSH_AUTH_SOCK`
aponta para path errado — confirma a tabela em § 1.

**`fatal: Authentication failed for 'https://git.iedora.com/...'`.** PAT
expirou ou foi revogado. Limpa cache: `echo "url=https://git.iedora.com" | git credential reject` e tenta de novo.

**Commit recusado por `✗ commit message não-conventional`.** Reescreve
o último: `git commit --amend -m "feat(scope): mensagem"`.

**Signing falha com `error: gpg failed to sign the data`.** Confirma que
Bitwarden Desktop está aberto e unlocked. Testa:
`echo test | ssh-keygen -Y sign -n git -f <(ssh-add -L | head -1)` deve
produzir uma assinatura.

**Hooks não correm em Windows.** Garante Git for Windows (Git Bash) e
permissão de execução: `chmod +x .git/hooks/*` em Git Bash.
