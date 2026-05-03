import type { InternalDocument } from "../adapters/types.ts";
import type { DatabaseAdapter } from "../adapters/types.ts";
import type { PluginRegistry } from "../plugin/registry.ts";
import type { HookContext } from "../plugin/types.ts";
import type { Document, Filter, Query } from "../types.ts";
import { generateId, timestamp } from "../helpers.ts";

type ErrorEmitter = (err: Error) => void;

export class Collection<T extends Document = Document> {
  public readonly name: string;
  private adapter: DatabaseAdapter;
  private registry: PluginRegistry;
  private makeCtx: () => HookContext;
  private emitError: ErrorEmitter;

  constructor(
    name: string,
    adapter: DatabaseAdapter,
    registry: PluginRegistry,
    makeCtx: () => HookContext,
    emitError: ErrorEmitter,
  ) {
    this.name = name;
    this.adapter = adapter;
    this.registry = registry;
    this.makeCtx = makeCtx;
    this.emitError = emitError;
  }

  async insert(doc: T): Promise<T & InternalDocument> {
    await this.adapter.createCollection(this.name);

    let internalDoc: InternalDocument = {
      ...doc,
      _id: generateId(),
      _createdAt: timestamp(),
      _updatedAt: timestamp(),
    };

    internalDoc = await this.registry.runBeforeInsert(this.name, internalDoc, this.makeCtx());

    const result = await this.adapter.insert(this.name, internalDoc);

    this.registry.runAfterInsert(this.name, result, this.makeCtx(), this.emitError);

    return result as T & InternalDocument;
  }

  async findById(id: string): Promise<(T & InternalDocument) | null> {
    const doc = await this.adapter.findById(this.name, id);
    return doc as (T & InternalDocument) | null;
  }

  async find(filter?: Filter<T>): Promise<(T & InternalDocument)[]> {
    await this.adapter.createCollection(this.name);

    let query: Query = { filter };
    query = await this.registry.runBeforeFind(this.name, query, this.makeCtx());

    const docs = await this.adapter.find(this.name, query);

    this.registry.runAfterFind(this.name, docs, this.makeCtx(), this.emitError);

    return docs as (T & InternalDocument)[];
  }

  async findOne(filter: Filter<T>): Promise<(T & InternalDocument) | null> {
    const results = await this.find(filter);
    return results[0] ?? null;
  }

  async update(filter: Filter<T>, changes: Partial<T>): Promise<number> {
    const docs = await this.find(filter);
    let cnt = 0;
    for (const doc of docs) {
      let finalChanges: Record<string, unknown> = { ...changes };

      finalChanges = await this.registry.runBeforeUpdate(
        this.name,
        doc._id,
        finalChanges,
        this.makeCtx(),
      );

      const updated = await this.adapter.update(this.name, doc._id, {
        ...finalChanges,
        _updatedAt: timestamp(),
      });

      this.registry.runAfterUpdate(this.name, updated, this.makeCtx(), this.emitError);

      cnt++;
    }
    return cnt;
  }

  async updateById(id: string, changes: Partial<T>): Promise<T & InternalDocument> {
    let finalChanges: Record<string, unknown> = { ...changes };

    finalChanges = await this.registry.runBeforeUpdate(this.name, id, finalChanges, this.makeCtx());

    const updated = await this.adapter.update(this.name, id, {
      ...finalChanges,
      _updatedAt: timestamp(),
    });

    this.registry.runAfterUpdate(this.name, updated, this.makeCtx(), this.emitError);

    return updated as T & InternalDocument;
  }

  async remove(filter: Filter<T>): Promise<number> {
    const docs = await this.find(filter);
    for (const doc of docs) {
      await this.registry.runBeforeRemove(this.name, doc._id, this.makeCtx());

      await this.adapter.remove(this.name, doc._id);

      this.registry.runAfterRemove(this.name, doc._id, this.makeCtx(), this.emitError);
    }
    return docs.length;
  }

  async removeById(id: string): Promise<void> {
    await this.registry.runBeforeRemove(this.name, id, this.makeCtx());

    await this.adapter.remove(this.name, id);

    this.registry.runAfterRemove(this.name, id, this.makeCtx(), this.emitError);
  }

  async count(filter?: Filter<T>): Promise<number> {
    return this.adapter.count(this.name, filter ?? {});
  }
}
