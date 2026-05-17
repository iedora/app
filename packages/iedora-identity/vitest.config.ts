import { defineConfig } from "vitest/config";

/**
 * Plain-node test surface — the package has no DOM coupling. HMAC,
 * fetch-shaped retries, signature verification are all node primitives.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 5_000,
  },
});
