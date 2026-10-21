import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // `server-only` throws outside React Server Components; tests run in plain Node.
    alias: { "server-only": fileURLToPath(new URL("../config/test-support/empty.ts", import.meta.url)) },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"], passWithNoTests: true },
});
