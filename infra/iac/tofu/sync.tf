# Day-2 compose / Caddyfile delivery.
#
# Hash-triggered single SSH session. When `local.compose_yaml` or
# `local.caddyfile` change, this resource fires once: scp the new files
# to /etc/iedora/, then `systemctl restart iedora.service` which re-runs
# `docker compose up -d --remove-orphans` (idempotent, reconciles drift).
#
# This is the ONLY SSH on Tofu's apply graph. Default parallelism is
# safe — there's no fan-out, no MaxStartups concern, no host-key dance.

resource "terraform_data" "iedora_sync" {
  triggers_replace = {
    server_id    = hcloud_server.iedora.id
    compose      = sha256(local.compose_yaml)
    caddyfile    = sha256(local.caddyfile)
    systemd_unit = sha256(local.systemd_unit)
  }

  connection {
    type        = "ssh"
    host        = hcloud_server.iedora.ipv4_address
    user        = "root"
    private_key = var.infra_ssh_private_key
    timeout     = "10m"
  }

  # Wait for cloud-init to finish on a fresh box. No-op on a warm box
  # (returns immediately if cloud-init is already in "done" state).
  provisioner "remote-exec" {
    inline = [
      "cloud-init status --wait >/dev/null",
      "install -d -m 0755 /etc/iedora /etc/iedora/postgres-init",
    ]
  }

  provisioner "file" {
    content     = local.compose_yaml
    destination = "/etc/iedora/docker-compose.yml"
  }

  provisioner "file" {
    content     = local.caddyfile
    destination = "/etc/iedora/Caddyfile"
  }

  provisioner "file" {
    content     = local.systemd_unit
    destination = "/etc/systemd/system/iedora.service"
  }

  # Reconcile.
  #   - `daemon-reload` picks up any change to the unit file.
  #   - `reload` runs ExecReload = `docker compose up -d --remove-
  #     orphans` — only containers whose config changed get recreated.
  #     `restart` would Stop+Start the whole stack via ExecStop=
  #     docker compose down, taking postgres + zitadel down for no
  #     reason.
  #   - `|| start` covers the case where the service isn't yet active
  #     (a fresh-box first apply where cloud-init beat us to it leaves
  #     it active, but a crashed/disabled box may not).
  provisioner "remote-exec" {
    inline = [
      "systemctl daemon-reload",
      "systemctl reload iedora.service || systemctl start iedora.service",
    ]
  }
}
