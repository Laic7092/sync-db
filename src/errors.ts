export class SyncDBError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "SyncDBError";
    this.code = code;
  }
}

export class CollectionNotFoundError extends SyncDBError {
  constructor(name: string) {
    super(`Collection "${name}" does not exist`, "COLLECTION_NOT_FOUND");
    this.name = "CollectionNotFoundError";
  }
}
