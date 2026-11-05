import {fileURLToPath} from "node:url";
import {defineConfig} from "vite";

export default defineConfig({
  resolve: {
    alias: {upuaut: fileURLToPath(new URL("../src/index.ts", import.meta.url))},
  },
  build: {outDir: "../dist-demo", emptyOutDir: true},
});
