import type { DatabaseAdapter, InternalDocument } from "./types.ts";
import type { Filter, Query } from "../types.ts";
import { executeQuery } from "../store/query.ts";

interface SQLiteModule {
  default: new (path: string) => SQLiteDB;
}

interface SQLiteDB {
  exec(sql: string): void;
  prepare(sql: string): SQLiteStmt;
  close(): void;
}

interface SQLiteStmt {
  run(...params: unknown[]): { changes: number };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

export class SQLiteAdapter implements DatabaseAdapter {
  readonly name = "sqlite";
  private db: SQLiteDB | null = null;

  async connect(databaseName: string): Promise<void> {
    const BetterSQLite3 = (await import("better-sqlite3")) as unknown as SQLiteModule;
    this.db = new BetterSQLite3.default(
      databaseName.endsWith(".db") ? databaseName : `${databaseName}.db`,
    );
    this.db.exec("PRAGMA journal_mode=WAL");
  }

  async disconnect(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  private mustGetDB(): SQLiteDB {
    if (!this.db) throw new Error("Not connected");
    return this.db;
  }

  async createCollection(name: string): Promise<void> {
    this.mustGetDB().exec(
      `CREATE TABLE IF NOT EXISTS "${name}" (_id TEXT PRIMARY KEY, doc TEXT NOT NULL)`,
    );
  }

  async dropCollection(name: string): Promise<void> {
    this.mustGetDB().exec(`DROP TABLE IF EXISTS "${name}"`);
  }

  async listCollections(): Promise<string[]> {
    const rows = this.mustGetDB()
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    return rows.map((r) => r.name);
  }

  private docToRow(doc: InternalDocument): { _id: string; doc: string } {
    return { _id: doc._id, doc: JSON.stringify(doc) };
  }

  private rowToDoc(row: { _id: string; doc: string }): InternalDocument {
    return JSON.parse(row.doc) as InternalDocument;
  }

  async insert(collection: string, doc: InternalDocument): Promise<InternalDocument> {
    const row = this.docToRow(doc);
    this.mustGetDB()
      .prepare(`INSERT INTO "${collection}" (_id, doc) VALUES (?, ?)`)
      .run(row._id, row.doc);
    return { ...doc };
  }

  async findById(collection: string, id: string): Promise<InternalDocument | null> {
    const row = this.mustGetDB()
      .prepare(`SELECT doc FROM "${collection}" WHERE _id = ?`)
      .get(id) as { doc: string } | undefined;
    return row ? this.rowToDoc({ _id: id, doc: row.doc }) : null;
  }

  async find(collection: string, query: Query): Promise<InternalDocument[]> {
    const rows = this.mustGetDB().prepare(`SELECT _id, doc FROM "${collection}"`).all() as {
      _id: string;
      doc: string;
    }[];
    const docs = rows.map((r) => this.rowToDoc(r));
    return executeQuery(docs, query);
  }

  async update(
    collection: string,
    id: string,
    changes: Record<string, unknown>,
  ): Promise<InternalDocument> {
    const row = this.mustGetDB()
      .prepare(`SELECT doc FROM "${collection}" WHERE _id = ?`)
      .get(id) as { doc: string } | undefined;
    if (!row) throw new Error(`Document "${id}" not found`);
    const existing = this.rowToDoc({ _id: id, doc: row.doc });
    const updated: InternalDocument = {
      ...existing,
      ...changes,
      _id: existing._id,
      _createdAt: existing._createdAt,
      _updatedAt: Date.now(),
      _deleted: existing._deleted,
    };
    const newRow = this.docToRow(updated);
    this.mustGetDB()
      .prepare(`UPDATE "${collection}" SET doc = ? WHERE _id = ?`)
      .run(newRow.doc, newRow._id);
    return { ...updated };
  }

  async remove(collection: string, id: string): Promise<void> {
    this.mustGetDB().prepare(`DELETE FROM "${collection}" WHERE _id = ?`).run(id);
  }

  async removeMany(collection: string, ids: string[]): Promise<number> {
    const stmt = this.mustGetDB().prepare(`DELETE FROM "${collection}" WHERE _id = ?`);
    let cnt = 0;
    for (const id of ids) {
      cnt += stmt.run(id).changes;
    }
    return cnt;
  }

  async count(collection: string, filter: Filter): Promise<number> {
    const rows = this.mustGetDB().prepare(`SELECT _id, doc FROM "${collection}"`).all() as {
      _id: string;
      doc: string;
    }[];
    const docs = rows.map((r) => this.rowToDoc(r));
    return executeQuery(docs, { filter }).length;
  }
}
