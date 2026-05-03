import type { DatabaseAdapter } from "./adapters/types.ts";
import type { Plugin } from "./plugin/types.ts";
import type { PluginClient } from "./plugin/types.ts";
import type { Document } from "./types.ts";
import type { HookContext } from "./plugin/types.ts";
import type { AdapterKind } from "./adapters/index.ts";
import type { TransportKind } from "./transports/types.ts";
import type { SyncEngine } from "./sync/engine.ts";
import { resolveAdapter } from "./adapters/index.ts";
import { resolveTransport } from "./transports/index.ts";
import { createSyncEngine } from "./sync/engine.ts";
import { PluginRegistry } from "./plugin/registry.ts";
import { Collection } from "./store/collection.ts";
import { timestamp } from "./helpers.ts";

export interface SyncDBConfig {
  adapter?: AdapterKind;
  adapterOptions?: Record<string, unknown>;
  transport?: TransportKind;
}

type ErrorHandler = (err: Error) => void;

export interface SyncDBClient {
  open(name: string, config?: Partial<SyncDBConfig>): Promise<void>;
  close(): Promise<void>;
  readonly isOpen: boolean;
  readonly databaseName: string | null;

  collection<T extends Document = Document>(name: string): Collection<T>;
  listCollections(): Promise<string[]>;

  use(plugin: Plugin): () => void;
  eject(pluginName: string): void;

  on(event: "error", handler: ErrorHandler): () => void;

  sync(url: string, transportKind?: TransportKind): Promise<void>;
  stopSync(): void;
  push(collection: string): Promise<void>;
  pull(collection: string): Promise<void>;
}

export function createClient(): SyncDBClient {
  let adapter: DatabaseAdapter | null = null;
  let dbName: string | null = null;
  let isOpen = false;
  let syncEngine: SyncEngine | null = null;
  const registry = new PluginRegistry();
  const errorHandlers = new Set<ErrorHandler>();
  const synced = new Set<string>();

  const emitError = (err: Error): void => {
    for (const h of errorHandlers) {
      try {
        h(err);
      } catch {
        /* swallow */
      }
    }
  };

  const makeCtx = (): HookContext => ({
    client: pluginClient,
    timestamp: timestamp(),
  });

  const pluginClient: PluginClient = {
    collection<T extends Document = Document>(name: string) {
      if (!adapter) throw new Error("Client is not open");
      return new Collection<T>(name, adapter, registry, makeCtx, emitError);
    },
    listCollections() {
      if (!adapter) throw new Error("Client is not open");
      return adapter.listCollections();
    },
  };

  const self: SyncDBClient = {
    get isOpen() {
      return isOpen;
    },
    get databaseName() {
      return dbName;
    },

    async open(name: string, config?: Partial<SyncDBConfig>): Promise<void> {
      if (isOpen) throw new Error("Client is already open");
      adapter = await resolveAdapter(config?.adapter ?? "auto");
      await adapter.connect(name);
      dbName = name;
      isOpen = true;
    },

    async close(): Promise<void> {
      if (syncEngine) syncEngine.stop();
      if (!isOpen || !adapter) return;
      await adapter.disconnect();
      dbName = null;
      isOpen = false;
    },

    collection<T extends Document = Document>(name: string): Collection<T> {
      if (!adapter) throw new Error("Client is not open");
      return new Collection<T>(name, adapter, registry, makeCtx, emitError);
    },

    async listCollections(): Promise<string[]> {
      if (!adapter) throw new Error("Client is not open");
      return adapter.listCollections();
    },

    use(plugin: Plugin): () => void {
      registry.register(plugin, pluginClient, emitError);
      return () => registry.unregister(plugin.name);
    },

    eject(pluginName: string): void {
      registry.unregister(pluginName);
    },

    on(_event: "error", handler: ErrorHandler): () => void {
      errorHandlers.add(handler);
      return () => {
        errorHandlers.delete(handler);
      };
    },

    async sync(url: string, transportKind?: TransportKind): Promise<void> {
      if (!adapter) throw new Error("Client is not open");
      if (syncEngine) syncEngine.stop();

      const transport = await resolveTransport(transportKind ?? "auto");
      await transport.connect(url);

      syncEngine = createSyncEngine(transport, adapter);
      await syncEngine.start([...synced]);
    },

    stopSync(): void {
      if (syncEngine) {
        syncEngine.stop();
        syncEngine = null;
      }
    },

    async push(collection: string): Promise<void> {
      if (!syncEngine) throw new Error("Sync is not active");
      synced.add(collection);
      await syncEngine.push(collection);
    },

    async pull(collection: string): Promise<void> {
      if (!syncEngine) throw new Error("Sync is not active");
      synced.add(collection);
      await syncEngine.pull(collection);
    },
  };

  return self;
}
