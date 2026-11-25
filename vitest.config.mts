import { defineConfig } from "vitest/config";

export default defineConfig({
  // `@/` imports, as in tsconfig.json, for the integration tests that load lib/ and app/ code.
  resolve: { tsconfigPaths: true },
  // PGlite boots Postgres in WASM and runs every migration once per integration test file.
  test: { testTimeout: 20_000, hookTimeout: 60_000 },
});
