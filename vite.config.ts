import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "SyncDB",
      formats: ["es", "cjs"],
      fileName: (format) => `sync-db.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: ["better-sqlite3", "ws"],
    },
  },
  lint: { options: { typeAware: true, typeCheck: true } },
});
