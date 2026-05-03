// ---- document types ----

/** User-facing document — no reserved fields exposed on input. */
export type Document = Record<string, unknown>;

/** Internal document stored by adapters. */
export interface InternalDocument {
  _id: string;
  _createdAt: number;
  _updatedAt: number;
  _deleted?: boolean;
  [key: string]: unknown;
}

// ---- filter / query types ----

export interface FilterOperator<T = unknown> {
  $eq?: T;
  $ne?: T;
  $gt?: number;
  $gte?: number;
  $lt?: number;
  $lte?: number;
  $in?: T[];
  $nin?: T[];
  $regex?: RegExp | string;
  $exists?: boolean;
}

export type Filter<T extends Document = Document> = {
  [P in keyof T]?: T[P] | FilterOperator<T[P]>;
} & {
  $or?: Filter<T>[];
  $and?: Filter<T>[];
};

export interface Query {
  filter?: Filter;
  sort?: Record<string, "asc" | "desc">;
  limit?: number;
  skip?: number;
}
