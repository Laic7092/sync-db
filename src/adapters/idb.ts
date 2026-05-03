import { openDB, type IDBPDatabase } from "idb";
import type { DatabaseAdapter, InternalDocument } from "./types.ts";
import type { Filter, Query } from "../types.ts";
import { executeQuery } from "../store/query.ts";

export class IndexedDBAdapter implements DatabaseAdapter {
  readonly name = "idb";
  private db: IDBPDatabase | null = null;
  private dbName = "";
  private registered = new Set<string>();

  async connect(databaseName: string): Promise<void> {
    this.dbName = databaseName;
    this.db = await openDB(databaseName, 1, {
      upgrade(_db) {
        // stores are added via createCollection which bumps the version
      },
    });
  }

  async disconnect(): Promise<void> {
    this.db?.close();
    this.db = null;
    this.registered.clear();
  }

  private mustGetDB(): IDBPDatabase {
    if (!this.db) throw new Error("Not connected");
    return this.db;
  }

  async createCollection(name: string): Promise<void> {
    if (this.registered.has(name)) return;
    this.registered.add(name);

    // bump version to add the new object store
    const oldVersion = this.mustGetDB().version;
    this.mustGetDB().close();

    this.db = await openDB(this.dbName, oldVersion + 1, {
      upgrade(db, _oldV, _newV, _tx) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "_id" });
        }
      },
    });
  }

  async dropCollection(name: string): Promise<void> {
    this.registered.delete(name);
    const oldVersion = this.mustGetDB().version;
    this.mustGetDB().close();

    this.db = await openDB(this.dbName, oldVersion + 1, {
      upgrade(db) {
        if (db.objectStoreNames.contains(name)) {
          db.deleteObjectStore(name);
        }
      },
    });
  }

  async listCollections(): Promise<string[]> {
    return [...this.mustGetDB().objectStoreNames];
  }

  async insert(collection: string, doc: InternalDocument): Promise<InternalDocument> {
    await this.mustGetDB().add(collection, doc);
    return { ...doc };
  }

  async findById(collection: string, id: string): Promise<InternalDocument | null> {
    const doc = await this.mustGetDB().get(collection, id);
    return (doc as InternalDocument | undefined) ?? null;
  }

  async find(collection: string, query: Query): Promise<InternalDocument[]> {
    const all = await this.mustGetDB().getAll(collection);
    return executeQuery(all as InternalDocument[], query);
  }

  async update(
    collection: string,
    id: string,
    changes: Record<string, unknown>,
  ): Promise<InternalDocument> {
    const existing = await this.mustGetDB().get(collection, id);
    if (!existing) throw new Error(`Document "${id}" not found`);
    const doc = existing as InternalDocument;
    const updated: InternalDocument = {
      ...doc,
      ...changes,
      _id: doc._id,
      _createdAt: doc._createdAt,
      _updatedAt: Date.now(),
      _deleted: doc._deleted,
    };
    await this.mustGetDB().put(collection, updated);
    return { ...updated };
  }

  async remove(collection: string, id: string): Promise<void> {
    await this.mustGetDB().delete(collection, id);
  }

  async removeMany(collection: string, ids: string[]): Promise<number> {
    const tx = this.mustGetDB().transaction(collection, "readwrite");
    let cnt = 0;
    for (const id of ids) {
      try {
        await tx.store.delete(id);
        cnt++;
      } catch {
        // ignore missing docs
      }
    }
    await tx.done;
    return cnt;
  }

  async count(collection: string, filter: Filter): Promise<number> {
    const all = await this.mustGetDB().getAll(collection);
    return executeQuery(all as InternalDocument[], { filter }).length;
  }
}
