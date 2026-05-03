import type { Transport } from "../transports/types.ts";
import type { DatabaseAdapter } from "../adapters/types.ts";
import type { SyncMessage, PushMessage } from "./protocol.ts";
import type { Query } from "../types.ts";

export interface SyncEngine {
  start(collections: string[]): Promise<void>;
  stop(): void;
  push(collection: string): Promise<void>;
  pull(collection: string): Promise<void>;
  readonly isRunning: boolean;
}

export function createSyncEngine(transport: Transport, adapter: DatabaseAdapter): SyncEngine {
  let running = false;
  const lastSync = new Map<string, number>();
  const unsubs: (() => void)[] = [];

  return {
    get isRunning() {
      return running;
    },

    async start(collections: string[]): Promise<void> {
      running = true;

      unsubs.push(
        transport.onMessage(async (msg: SyncMessage) => {
          if (msg.type === "push") {
            for (const doc of msg.documents) {
              await adapter.insert(msg.collection, doc).catch(async () => {
                const existing = await adapter.findById(msg.collection, doc._id);
                if (!existing || doc._updatedAt >= existing._updatedAt) {
                  await adapter.update(msg.collection, doc._id, doc);
                }
              });
            }
            await transport.send({
              type: "ack",
              collection: msg.collection,
              ids: msg.documents.map((d) => d._id),
            });
            for (const d of msg.documents) {
              const cur = lastSync.get(msg.collection) ?? 0;
              if (d._updatedAt > cur) lastSync.set(msg.collection, d._updatedAt);
            }
          }
          if (msg.type === "pull-response") {
            for (const doc of msg.documents) {
              await adapter.insert(msg.collection, doc).catch(async () => {
                const existing = await adapter.findById(msg.collection, doc._id);
                if (!existing || doc._updatedAt >= existing._updatedAt) {
                  await adapter.update(msg.collection, doc._id, doc);
                }
              });
            }
            for (const d of msg.documents) {
              const cur = lastSync.get(msg.collection) ?? 0;
              if (d._updatedAt > cur) lastSync.set(msg.collection, d._updatedAt);
            }
          }
        }),
      );

      for (const col of collections) {
        await transport.send({
          type: "pull",
          collection: col,
          since: lastSync.get(col) ?? 0,
        });
      }

      // start polling if HTTP transport
      const t = transport as unknown as { startPolling?: (since: number, cols: string[]) => void };
      if (typeof t.startPolling === "function") {
        t.startPolling(0, collections);
      }
    },

    stop(): void {
      running = false;
      for (const u of unsubs) u();
      unsubs.length = 0;
    },

    async push(collection: string): Promise<void> {
      const since = lastSync.get(collection) ?? 0;
      const docs = await adapter.find(collection, {
        filter: { _updatedAt: { $gt: since } as Record<string, unknown> },
      } as Query);
      if (docs.length === 0) return;
      await transport.send({
        type: "push",
        collection,
        documents: docs,
      } as PushMessage);
    },

    async pull(collection: string): Promise<void> {
      await transport.send({
        type: "pull",
        collection,
        since: lastSync.get(collection) ?? 0,
      });
    },
  };
}
