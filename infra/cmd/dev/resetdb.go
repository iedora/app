package main

// Per-service database reset. The dev stack runs ONE shared infra-postgres
// container with several databases inside (`menu`, `zitadel`, future
// products). A blanket "wipe postgres" is too coarse for iterative dev —
// re-bootstrapping Zitadel takes ~30s and isn't usually what you want
// just because you're tinkering with menu's schema. So --reset-db takes
// the name of ONE service, and we tear down exactly that database.
//
// Adding a new SQL-backed service: add a case to the switch in resetDB()
// + an implementation function. Each must be safe to run repeatedly.

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// resetDB dispatches to the per-service reset function. Unknown service
// → loud error rather than a silent no-op.
func resetDB(service, repoRoot, devTofuDir string) {
	switch service {
	case "menu":
		resetMenuDB()
	case "zitadel":
		resetZitadelDB(repoRoot, devTofuDir)
	default:
		fail("--reset-db: unknown service %q (supported: menu, zitadel)", service)
	}
}

// resetMenuDB is the simple path: DROP + CREATE the `menu` database
// inside the running infra-postgres container. Drizzle re-runs every
// migration on the next `bun run dev`. Doesn't touch Zitadel — that
// DB stays put with its bootstrap state intact.
func resetMenuDB() {
	requirePostgresRunning()
	stepOf(1, 2, "DROP DATABASE menu WITH (FORCE)")
	runIn("", "docker", "exec", "infra-postgres",
		"psql", "-U", "postgres", "-c", "DROP DATABASE IF EXISTS menu WITH (FORCE);")
	stepOf(2, 2, "CREATE DATABASE menu")
	runIn("", "docker", "exec", "infra-postgres",
		"psql", "-U", "postgres", "-c", "CREATE DATABASE menu;")
	fmt.Printf("%s menu database reset. Next `bun run dev` re-runs drizzle migrations.\n", logPrefix)
}

// resetZitadelDB tears Zitadel's state down to FirstInstance-fresh:
// stop the containers, drop the DB, wipe the bootstrap key file, then
// state-rm every zitadel_* resource and re-run applyDevStack. The next
// FirstInstance regenerates a new admin SA key on the bootstrap volume,
// and Pass 4 (seed) imports the org/project/PAT against it. Equivalent
// to the old `just infra::zitadel-rebootstrap` recipe, scoped to dev.
//
// This is heavier than the menu reset — ~30s end-to-end — because we
// can't avoid the FirstInstance migration on a fresh DB. There's no
// faster path: Zitadel's projection tables are encrypted with the
// masterkey and re-keying mid-flight is unsupported.
func resetZitadelDB(repoRoot, devTofuDir string) {
	requirePostgresRunning()

	stepOf(1, 5, "stop infra-zitadel{,-login} containers")
	runQuiet("", "docker", "rm", "-f", "infra-zitadel", "infra-zitadel-login")

	stepOf(2, 5, "DROP + CREATE zitadel database")
	runIn("", "docker", "exec", "infra-postgres",
		"psql", "-U", "postgres", "-c", "DROP DATABASE IF EXISTS zitadel WITH (FORCE); CREATE DATABASE zitadel;")

	stepOf(3, 5, "wipe FirstInstance SA key on bootstrap dir")
	bootstrapDir := filepath.Join(repoRoot, "infra/dev/.zitadel-bootstrap")
	saKeyPath := filepath.Join(repoRoot, zitadelSAKeyPathRel)
	if err := os.Remove(saKeyPath); err != nil && !os.IsNotExist(err) {
		warn("remove %s: %v (continuing)", saKeyPath, err)
	}
	// Also drop the Docker named volume so its perms reset cleanly. The
	// next apply re-creates it via the `zitadel_bootstrap_chmod` resource.
	runQuiet("", "docker", "volume", "rm", "zitadel-bootstrap")
	_ = bootstrapDir // path is the repo-side mirror, kept for future use

	stepOf(4, 5, "state-rm every zitadel_* resource")
	stateRmDevZitadel(devTofuDir)

	stepOf(5, 5, "re-apply (FirstInstance regenerates SA key + seed lands resources)")
	// Re-use the same selection logic as a normal `just dev` — everything
	// the operator had up stays up; Zitadel comes back cold.
	applyDevStack(defaultSelection(), repoRoot, devTofuDir)
	fmt.Printf("%s zitadel rebootstrapped. iedora org/project/PAT re-imported declaratively.\n", logPrefix)
}

// requirePostgresRunning bails early if infra-postgres isn't up. Both
// reset paths assume it's there — the alternative would be a partial
// recovery that leaves the operator's stack in a worse state than they
// started.
func requirePostgresRunning() {
	out, err := exec.Command("docker", "ps", "--filter", "name=infra-postgres", "--format", "{{.Names}}").Output()
	if err != nil || !strings.Contains(string(out), "infra-postgres") {
		fail("infra-postgres is not running — run `just dev` first, then `just dev --reset-db <service>`.")
	}
}
