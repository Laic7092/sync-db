import type { Filter, InternalDocument, Query } from "../types.ts";
import type { DatabaseAdapter } from "./types.ts";
import { executeQuery } from "../store/query.ts";

export class InMemoryAdapter implements DatabaseAdapter {
  readonly name = "memory";
  private store = new Map<string, Map<string, InternalDocument>>();

  async connect(_databaseName: string): Promise<void> {
    // nothing to do — in-memory is always ready
  }

  async disconnect(): Promise<void> {
    this.store.clear();
  }

  async createCollection(name: string): Promise<void> {
    if (!this.store.has(name)) {
      this.store.set(name, new Map());
    }
  }

  async dropCollection(name: string): Promise<void> {
    this.store.delete(name);
  }

  async listCollections(): Promise<string[]> {
    return [...this.store.keys()];
  }

  private mustGet(col: string): Map<string, InternalDocument> {
    const m = this.store.get(col);
    if (!m) throw new Error(`Collection "${col}" not found`);
    return m;
  }

  async insert(collection: string, doc: InternalDocument): Promise<InternalDocument> {
    const col = this.mustGet(collection);
    col.set(doc._id, { ...doc });
    return { ...doc };
  }

  async findById(collection: string, id: string): Promise<InternalDocument | null> {
    const doc = this.mustGet(collection).get(id);
    return doc ? { ...doc } : null;
  }

  async find(collection: string, query: Query): Promise<InternalDocument[]> {
    const docs = [...this.mustGet(collection).values()];
    return executeQuery(
      docs.map((d) => ({ ...d })),
      query,
    );
  }

  async update(
    collection: string,
    id: string,
    changes: Record<string, unknown>,
  ): Promise<InternalDocument> {
    const col = this.mustGet(collection);
    const existing = col.get(id);
    if (!existing) throw new Error(`Document "${id}" not found`);
    const updated: InternalDocument = {
      ...existing,
      ...changes,
      _id: existing._id,
      _createdAt: existing._createdAt,
      _updatedAt: Date.now(),
      _deleted: existing._deleted,
    };
    col.set(id, updated);
    return { ...updated };
  }

  async remove(collection: string, id: string): Promise<void> {
    this.mustGet(collection).delete(id);
  }

  async removeMany(collection: string, ids: string[]): Promise<number> {
    const col = this.mustGet(collection);
    let cnt = 0;
    for (const id of ids) {
      if (col.delete(id)) cnt++;
    }
    return cnt;
  }

  async count(collection: string, filter: Filter): Promise<number> {
    const docs = [...this.mustGet(collection).values()];
    return executeQuery(docs, { filter }).length;
  }
}
