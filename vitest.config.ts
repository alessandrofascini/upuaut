import {fileURLToPath} from "node:url";
import {defineConfig} from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {upuaut: fileURLToPath(new URL("./src/index.ts", import.meta.url))},
  },
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      reporter: ["text", "html", "lcov"],
    },
  },
});
