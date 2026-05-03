import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import dts from "vite-plugin-dts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "SyncDB",
      formats: ["es", "cjs"],
      fileName: (format) => `sync-db.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: ["better-sqlite3"],
    },
  },
  plugins: [dts({ insertTypesEntry: true, rollupTypes: true })],
  lint: { options: { typeAware: true, typeCheck: true } },
});
