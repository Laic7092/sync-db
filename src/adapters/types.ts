import type { Filter, InternalDocument, Query } from "../types.ts";

export type { InternalDocument };

export interface DatabaseAdapter {
  readonly name: string;

  connect(databaseName: string): Promise<void>;
  disconnect(): Promise<void>;

  createCollection(name: string): Promise<void>;
  dropCollection(name: string): Promise<void>;
  listCollections(): Promise<string[]>;

  insert(collection: string, doc: InternalDocument): Promise<InternalDocument>;
  findById(collection: string, id: string): Promise<InternalDocument | null>;
  find(collection: string, query: Query): Promise<InternalDocument[]>;
  update(
    collection: string,
    id: string,
    changes: Record<string, unknown>,
  ): Promise<InternalDocument>;
  remove(collection: string, id: string): Promise<void>;
  removeMany(collection: string, ids: string[]): Promise<number>;
  count(collection: string, filter: Filter): Promise<number>;
}
