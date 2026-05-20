// Dev orchestrator. Same shape as prod: shared infra (postgres,
// localstack, zitadel, openobserve) sits at infra/dev/, products
// (menu) consume it.
//
// Default: bring up everything — `bun run dev` / `just dev`.
//
// Subset selection (deps auto-resolved):
//   bun run dev -i                  interactive TUI per category
//   bun run dev --only menu         menu + everything menu needs
//   bun run dev --only zitadel      compose's zitadel + postgres (skips next dev)
//   bun run dev --except openobserve  everything except observability
//
// When the user opts out of a service the menu depends on, dev.go does
// NOT write the dynamic .env.local — the user is responsible for
// hand-providing those keys (or pointing them at an alternate IdP /
// db / S3).
//
// Stdlib only except for `github.com/charmbracelet/huh` (one Charm dep
// for the grouped multi-select TUI). go.mod committed.

package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/charmbracelet/huh"
)

// ── Service graph ───────────────────────────────────────────────────────────

type category string

const (
	catInfra    category = "infra"
	catProducts category = "products"
)

type service struct {
	name        string   // selection key + label
	composeName []string // docker-compose service names; empty for host-run apps
	deps        []string // transitive selection deps (other service.name values)
	cat         category
}

// Ordered for deterministic UI rendering.
var allServices = []service{
	{name: "postgres", composeName: []string{"postgres"}, cat: catInfra},
	{name: "localstack", composeName: []string{"localstack"}, cat: catInfra},
	{name: "zitadel", composeName: []string{"zitadel", "zitadel-login"}, deps: []string{"postgres"}, cat: catInfra},
	{name: "openobserve", composeName: []string{"openobserve"}, deps: []string{"localstack"}, cat: catInfra},
	{name: "menu", deps: []string{"postgres", "localstack", "zitadel", "openobserve"}, cat: catProducts},
}

func serviceByName(n string) (service, bool) {
	for _, s := range allServices {
		if s.name == n {
			return s, true
		}
	}
	return service{}, false
}

func defaultSelection() []string {
	out := make([]string, 0, len(allServices))
	for _, s := range allServices {
		out = append(out, s.name)
	}
	return out
}

// expandDeps closes `selected` over `service.deps`. Result is sorted.
func expandDeps(selected []string) []string {
	set := map[string]bool{}
	var dfs func(string)
	dfs = func(n string) {
		if set[n] {
			return
		}
		set[n] = true
		s, ok := serviceByName(n)
		if !ok {
			fail("unknown service %q", n)
		}
		for _, d := range s.deps {
			dfs(d)
		}
	}
	for _, n := range selected {
		dfs(n)
	}
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// composeServiceNames maps the selection to docker-compose service names.
// Skips entries with no compose presence (e.g. menu — host-run via Next).
func composeServiceNames(selected []string) []string {
	out := []string{}
	for _, n := range selected {
		s, _ := serviceByName(n)
		out = append(out, s.composeName...)
	}
	sort.Strings(out)
	return out
}

func contains(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}

// ── Main ─────────────────────────────────────────────────────────────────────

func main() {
	interactive := flag.Bool("i", false, "interactive selection (TUI per category)")
	flag.BoolVar(interactive, "interactive", false, "alias for -i")
	only := flag.String("only", "", "comma-separated services to start (+ their deps); skips everything else")
	except := flag.String("except", "", "comma-separated services to skip; everything else (+ their deps) starts")
	flag.Parse()

	selected, err := resolveSelection(*interactive, *only, *except)
	if err != nil {
		fail("%v", err)
	}
	selected = expandDeps(selected)
	// `--except` must win over dep-expansion: a user saying
	// `--except openobserve` doesn't want it back through menu's deps.
	// The menu app boots either way — when OTLP_ENDPOINT can't reach
	// the collector, the observability SDK degrades to a no-op silently.
	if *except != "" {
		blocked := map[string]bool{}
		for _, n := range splitCSV(*except) {
			blocked[n] = true
		}
		filtered := selected[:0]
		for _, n := range selected {
			if !blocked[n] {
				filtered = append(filtered, n)
			}
		}
		selected = filtered
	}
	if len(selected) == 0 {
		fail("empty selection — pick at least one service")
	}

	repoRoot := findRepoRoot()
	devInfraDir := filepath.Join(repoRoot, "infra/dev")
	devTofuDir := filepath.Join(repoRoot, "infra/dev/tofu")
	menuDir := filepath.Join(repoRoot, "products/menu")

	fmt.Printf("[dev] running: %s\n", strings.Join(selected, ", "))

	step(1, "docker compose up -d --wait")
	composeArgs := append([]string{"compose", "up", "-d", "--wait"}, composeServiceNames(selected)...)
	runIn(devInfraDir, "docker", composeArgs...)

	// Zitadel-bound steps. Skip when the user opted out — they're
	// responsible for providing the dynamic Zitadel keys in
	// products/menu/.env.local (or hitting a remote IdP).
	if contains(selected, "zitadel") {
		step(2, "waiting for .zitadel-bootstrap/menu-sa.pat")
		patPath := filepath.Join(devInfraDir, ".zitadel-bootstrap/menu-sa.pat")
		if err := waitForFile(patPath, 60*time.Second); err != nil {
			fail("%v\nhint: docker compose -f infra/dev/docker-compose.yml logs zitadel", err)
		}
		patBytes, _ := os.ReadFile(patPath)
		pat := strings.TrimSpace(string(patBytes))

		step(3, "tofu apply (seed Zitadel + emit env files)")
		runIn(devTofuDir, "tofu", "init", "-upgrade", "-input=false")
		runIn(devTofuDir, "tofu", "apply", "-auto-approve", "-input=false", "-var", "zitadel_pat="+pat)

		step(4, "write products/menu/{.env,.env.local}")
		writeEnvFile(filepath.Join(menuDir, ".env"),
			captureIn(devTofuDir, "tofu", "output", "-raw", "env_committable_file"),
			false, 0o644)
		writeEnvFile(filepath.Join(menuDir, ".env.local"),
			captureIn(devTofuDir, "tofu", "output", "-raw", "env_dynamic_file"),
			true, 0o600)
	} else {
		warn("zitadel opted out — leaving .env.local untouched. Make sure ZITADEL_OAUTH_CLIENT_ID/SECRET/MANAGEMENT_TOKEN point at a real IdP, or auth flows will 500.")
	}

	// Menu host-run steps. Skip when menu is opted out (infra-only mode).
	if contains(selected, "menu") {
		step(5, "drizzle migrate + next dev")
		runIn(menuDir, "bun", "run", "db:migrate")
		if err := os.Chdir(menuDir); err != nil {
			fail("chdir %s: %v", menuDir, err)
		}
		execv("bun", "--bun", "next", "dev")
		return
	}

	fmt.Println("[dev] menu opted out — infra is up, exiting (the compose stack stays running in background)")
}

// ── Selection: flags + interactive ──────────────────────────────────────────

func resolveSelection(interactive bool, only, except string) ([]string, error) {
	if interactive {
		return runTUI()
	}
	if only != "" && except != "" {
		return nil, fmt.Errorf("--only and --except are mutually exclusive")
	}
	if only != "" {
		return splitCSV(only), nil
	}
	if except != "" {
		excluded := map[string]bool{}
		for _, n := range splitCSV(except) {
			excluded[n] = true
		}
		out := []string{}
		for _, s := range allServices {
			if !excluded[s.name] {
				out = append(out, s.name)
			}
		}
		return out, nil
	}
	return defaultSelection(), nil
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// runTUI presents a per-category multi-select. Returns the selection
// the user confirmed (Enter on the last group).
func runTUI() ([]string, error) {
	groups := map[category][]huh.Option[string]{}
	for _, s := range allServices {
		groups[s.cat] = append(groups[s.cat], huh.NewOption(s.name, s.name).Selected(true))
	}

	var infraSelected, productsSelected []string
	form := huh.NewForm(
		huh.NewGroup(
			huh.NewMultiSelect[string]().
				Title("infra").
				Description("Backing services. Postgres + LocalStack required for any menu use; Zitadel optional if pointing at a remote IdP; OpenObserve optional.").
				Options(groups[catInfra]...).
				Value(&infraSelected),
		),
		huh.NewGroup(
			huh.NewMultiSelect[string]().
				Title("products").
				Description("Host-run apps. Menu boots Next.js after the infra it depends on is up.").
				Options(groups[catProducts]...).
				Value(&productsSelected),
		),
	)
	if err := form.Run(); err != nil {
		return nil, err
	}
	return append(infraSelected, productsSelected...), nil
}

// ── File helpers ─────────────────────────────────────────────────────────────

func writeEnvFile(path, body string, dynamic bool, mode os.FileMode) {
	header := envHeader(dynamic)
	if err := os.WriteFile(path, []byte(header+body+"\n"), mode); err != nil {
		fail("write %s: %v", path, err)
	}
}

func envHeader(dynamic bool) string {
	if dynamic {
		return "# AUTO-GENERATED by `bun run dev` (infra/modules/menu_env).\n" +
			"# Holds the dynamic dev secrets (Zitadel client + session key) —\n" +
			"# rewritten on every run. Hand-edits survive until the next run;\n" +
			"# permanent overrides go in `.env` (committed).\n\n"
	}
	return "# AUTO-GENERATED by `bun run dev` (infra/modules/menu_env).\n" +
		"# Static dev defaults + Zod-valid placeholders for the dynamic keys.\n" +
		"# Real values for the dynamic keys live in `.env.local` (gitignored,\n" +
		"# regenerated by every `bun run dev`).\n" +
		"# Commit changes here when the env schema evolves.\n\n"
}

// ── Process helpers ──────────────────────────────────────────────────────────

func findRepoRoot() string {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		fail("runtime.Caller failed")
	}
	// <repo>/infra/dev/dev.go → two levels up.
	return filepath.Dir(filepath.Dir(filepath.Dir(thisFile)))
}

func step(n int, msg string) {
	fmt.Printf("[dev] %d/5  %s\n", n, msg)
}

func warn(msg string) {
	fmt.Fprintf(os.Stderr, "[dev] WARN: %s\n", msg)
}

func runIn(dir, name string, args ...string) {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fail("%s %v: %v", name, args, err)
	}
}

func captureIn(dir, name string, args ...string) string {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Stderr = os.Stderr
	out, err := cmd.Output()
	if err != nil {
		fail("%s %v: %v", name, args, err)
	}
	return strings.TrimSpace(string(out))
}

// execv replaces the current process with the target so signals
// (Ctrl-C) flow naturally — same as `exec` at the end of a bash
// script.
func execv(name string, args ...string) {
	path, err := exec.LookPath(name)
	if err != nil {
		fail("look up %s: %v", name, err)
	}
	if err := syscall.Exec(path, append([]string{name}, args...), os.Environ()); err != nil {
		fail("exec %s: %v", name, err)
	}
}

func waitForFile(path string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		info, err := os.Stat(path)
		if err == nil && info.Size() > 0 {
			return nil
		}
		time.Sleep(500 * time.Millisecond)
	}
	return fmt.Errorf("timed out after %s waiting for %s", timeout, path)
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "[dev] "+format+"\n", args...)
	os.Exit(1)
}
