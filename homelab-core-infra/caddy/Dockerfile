# Caddy + Cloudflare DNS-01 plugin (não vem na imagem oficial).
# Built once via compose; cache de layers garante re-build rápido.
FROM caddy:2.10-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2.10
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
