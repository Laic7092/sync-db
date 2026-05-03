export { createClient } from "./client.ts";
export type { SyncDBClient, SyncDBConfig } from "./client.ts";

export type { Document, Filter, FilterOperator, Query } from "./types.ts";

export type { Collection } from "./store/collection.ts";

export type { Plugin, HookContext, PluginClient } from "./plugin/types.ts";

export type { DatabaseAdapter, InternalDocument } from "./adapters/types.ts";
export { InMemoryAdapter } from "./adapters/memory.ts";
export type { AdapterKind } from "./adapters/index.ts";

export type { Transport, TransportKind } from "./transports/types.ts";
export type { SyncMessage } from "./sync/protocol.ts";
export { HTTPTransport } from "./transports/http.ts";
export { WebSocketTransport } from "./transports/ws.ts";
export { WebRTCTransport } from "./transports/webrtc.ts";

export { createWSServer, createSignalServer, SyncHandler } from "./server/index.ts";
export type { WSServerOptions, SignalServerOptions } from "./server/index.ts";

export { detectEnv } from "./env.ts";
export type { EnvInfo } from "./env.ts";

export { SyncDBError, CollectionNotFoundError } from "./errors.ts";

export { LoggerPlugin } from "./plugins/logger.ts";
export type { LoggerOptions } from "./plugins/logger.ts";
