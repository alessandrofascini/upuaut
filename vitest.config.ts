import {fileURLToPath} from "node:url";
import {playwright} from "@vitest/browser-playwright";
import {defineConfig} from "vitest/config";

const browserTests = ["tests/components.test.ts", "tests/demo.test.ts", "tests/history.test.ts"];

export default defineConfig({
  resolve: {
    alias: {upuaut: fileURLToPath(new URL("./src/index.ts", import.meta.url))},
  },
  test: {
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      reporter: ["text", "html", "lcov"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "happy-dom",
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: browserTests,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{browser: "chromium"}],
          },
        },
      },
    ],
  },
});
