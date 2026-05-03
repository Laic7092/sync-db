import type { DatabaseAdapter } from "./types.ts";
import { detectEnv } from "../env.ts";

export type AdapterKind = "auto" | "memory" | "idb" | "sqlite";

export async function resolveAdapter(kind: AdapterKind = "auto"): Promise<DatabaseAdapter> {
  if (kind === "memory") {
    const { InMemoryAdapter } = await import("./memory.ts");
    return new InMemoryAdapter();
  }

  const env = detectEnv();

  if (kind === "idb" || (kind === "auto" && env.runtime === "browser" && env.hasIndexedDB)) {
    try {
      const { IndexedDBAdapter } = await import("./idb.ts");
      return new IndexedDBAdapter();
    } catch {
      // idb not available — fall through
    }
  }

  if (kind === "sqlite" || (kind === "auto" && env.runtime === "node")) {
    try {
      const { SQLiteAdapter } = await import("./sqlite.ts");
      return new SQLiteAdapter();
    } catch {
      // better-sqlite3 not available — fall through
    }
  }

  // fallback
  const { InMemoryAdapter } = await import("./memory.ts");
  return new InMemoryAdapter();
}

export { InMemoryAdapter } from "./memory.ts";
export type { DatabaseAdapter } from "./types.ts";
