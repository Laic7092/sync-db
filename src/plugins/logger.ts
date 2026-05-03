import type { Plugin, HookContext } from "../plugin/types.ts";
import type { InternalDocument } from "../adapters/types.ts";
import type { Query } from "../types.ts";

export interface LoggerOptions {
  level?: "debug" | "info" | "warn";
}

export class LoggerPlugin implements Plugin {
  name = "logger";
  private log: (...args: unknown[]) => void;

  constructor(opts?: LoggerOptions) {
    const level = opts?.level ?? "info";
    this.log = level === "debug" ? console.debug : level === "warn" ? console.warn : console.info;
  }

  beforeInsert(collection: string, doc: InternalDocument, _ctx: HookContext): InternalDocument {
    this.log(`[sync-db] ${collection}: beforeInsert ${doc._id}`);
    return doc;
  }

  afterInsert(collection: string, doc: InternalDocument, _ctx: HookContext): void {
    this.log(`[sync-db] ${collection}: afterInsert ${doc._id}`);
  }

  beforeUpdate(
    collection: string,
    id: string,
    changes: Record<string, unknown>,
    _ctx: HookContext,
  ): Record<string, unknown> {
    this.log(`[sync-db] ${collection}: beforeUpdate ${id}`, changes);
    return changes;
  }

  afterUpdate(collection: string, doc: InternalDocument, _ctx: HookContext): void {
    this.log(`[sync-db] ${collection}: afterUpdate ${doc._id}`);
  }

  beforeRemove(collection: string, id: string, _ctx: HookContext): void {
    this.log(`[sync-db] ${collection}: beforeRemove ${id}`);
  }

  afterRemove(collection: string, id: string, _ctx: HookContext): void {
    this.log(`[sync-db] ${collection}: afterRemove ${id}`);
  }

  beforeFind(collection: string, query: Query, _ctx: HookContext): Query {
    this.log(`[sync-db] ${collection}: beforeFind`, query);
    return query;
  }

  afterFind(collection: string, docs: InternalDocument[], _ctx: HookContext): InternalDocument[] {
    this.log(`[sync-db] ${collection}: afterFind (${docs.length} results)`);
    return docs;
  }
}
