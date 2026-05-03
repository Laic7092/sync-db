import type { InternalDocument } from "../adapters/types.ts";
import type { Document, Filter, Query } from "../types.ts";

/** Minimal client view exposed to plugins. */
export interface PluginClient {
  collection<T extends Document = Document>(
    name: string,
  ): {
    insert(doc: T): Promise<T & InternalDocument>;
    find(filter?: Filter<T>): Promise<(T & InternalDocument)[]>;
    findById(id: string): Promise<(T & InternalDocument) | null>;
    findOne(filter: Filter<T>): Promise<(T & InternalDocument) | null>;
    update(filter: Filter<T>, changes: Partial<T>): Promise<number>;
    updateById(id: string, changes: Partial<T>): Promise<T & InternalDocument>;
    remove(filter: Filter<T>): Promise<number>;
    removeById(id: string): Promise<void>;
    count(filter?: Filter<T>): Promise<number>;
  };
  listCollections(): Promise<string[]>;
}

export interface HookContext {
  client: PluginClient;
  timestamp: number;
}

export interface Plugin {
  name: string;

  onRegister?: (client: PluginClient) => void | Promise<void>;
  onUnregister?: () => void | Promise<void>;

  beforeInsert?:
    | ((
        collection: string,
        doc: InternalDocument,
        ctx: HookContext,
      ) => InternalDocument | Promise<InternalDocument>)
    | undefined;
  afterInsert?:
    | ((collection: string, doc: InternalDocument, ctx: HookContext) => void | Promise<void>)
    | undefined;

  beforeUpdate?:
    | ((
        collection: string,
        id: string,
        changes: Record<string, unknown>,
        ctx: HookContext,
      ) => Record<string, unknown> | Promise<Record<string, unknown>>)
    | undefined;
  afterUpdate?:
    | ((collection: string, doc: InternalDocument, ctx: HookContext) => void | Promise<void>)
    | undefined;

  beforeRemove?:
    | ((collection: string, id: string, ctx: HookContext) => void | Promise<void>)
    | undefined;
  afterRemove?:
    | ((collection: string, id: string, ctx: HookContext) => void | Promise<void>)
    | undefined;

  beforeFind?:
    | ((collection: string, query: Query, ctx: HookContext) => Query | Promise<Query>)
    | undefined;
  afterFind?:
    | ((
        collection: string,
        docs: InternalDocument[],
        ctx: HookContext,
      ) => InternalDocument[] | Promise<InternalDocument[]>)
    | undefined;
}
