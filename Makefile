.PHONY: help deploy setup destroy tofu-apply logs console redeploy rollback migrate

# Single source of truth: .env at the repo root. `-include` (with the dash)
# won't error on first-clone state; `export` makes values visible to subprocesses.
-include .env
export

# Kamal is a Ruby gem; gem-bin isn't on the default PATH on macOS. Glob the
# brew-Ruby gem-bin directory generically and prepend it via the recipe so
# Make is forced to go through a shell (otherwise execvp bypasses our PATH).
KAMAL_GEM_BIN := $(firstword $(wildcard /opt/homebrew/lib/ruby/gems/*/bin) $(HOME)/.gem/ruby/*/bin)

# Derived from PUBLIC_HOSTNAME. menu.733113.xyz → assets.733113.xyz.
export ASSETS_HOSTNAME   ?= assets.$(shell echo $(PUBLIC_HOSTNAME) | cut -d. -f2-)

# Pipe .env values into TF_VAR_ names so we don't repeat them in Tofu.
export TF_VAR_account_id            := $(CLOUDFLARE_ACCOUNT_ID)
export TF_VAR_zone_id               := $(CLOUDFLARE_ZONE_ID)
export TF_VAR_cloudflare_api_token  := $(CLOUDFLARE_API_TOKEN)
export TF_VAR_state_passphrase      := $(STATE_PASSPHRASE)
export TF_VAR_public_hostname       := $(PUBLIC_HOSTNAME)

TOFU  := tofu -chdir=infra/tofu
KAMAL := PATH="$(KAMAL_GEM_BIN):$$PATH" kamal

help:  ## Show this help
	@echo "First-time setup (once, manual):"
	@echo "  1. cp .env.example .env  &&  edit (7 inputs + 4 generated secrets)"
	@echo "  2. ssh-copy-id root@\$$ONPREM_HOST   (cloud VPS images ship with this already; homelab needs it once)"
	@echo "  3. gh auth refresh -s write:packages"
	@echo "  4. make setup"
	@echo ""
	@echo "  Note: Kamal connects as root with SSH-key-only login — that's the gem's design"
	@echo "  (kamal server bootstrap installs Docker via get.docker.com which needs root)."
	@echo "  Use a separate sudo human user (pwu/eduardo/...) for ad-hoc admin."
	@echo ""
	@echo "Deploy:"
	@echo "  make deploy           - tofu apply + kamal deploy"
	@echo ""
	@echo "Day-to-day:"
	@echo "  make logs             - tail app logs"
	@echo "  make console          - bash inside the app container"
	@echo "  make migrate          - run migrations against current image"
	@echo "  make redeploy         - re-pull current image, no rebuild"
	@echo "  make rollback         - rollback to previous version"
	@echo ""
	@echo "Teardown:"
	@echo "  make destroy          - remove Cloudflare tunnel + DNS (does not touch the box)"

deploy: tofu-apply  ## Build + push to GHCR + deploy
	$(KAMAL) deploy

setup: tofu-apply  ## First-time: install Docker on the box, boot accessories, deploy
	$(KAMAL) server bootstrap
	$(KAMAL) accessory boot all
	$(KAMAL) deploy

tofu-apply:
	@$(TOFU) init -upgrade -input=false >/dev/null
	$(TOFU) apply -auto-approve

destroy:  ## Tofu destroy: removes Cloudflare tunnel + DNS only
	$(TOFU) destroy -auto-approve

logs:      ; $(KAMAL) app logs -f
console:   ; $(KAMAL) app exec --interactive --reuse bash
redeploy:  ; $(KAMAL) redeploy
rollback:  ; $(KAMAL) rollback
migrate:   ; $(KAMAL) app exec --reuse "node scripts/migrate.mjs"
