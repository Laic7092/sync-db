import type {
  SyncMessage,
  PushMessage,
  PullMessage,
  PullResponse,
  AckMessage,
} from "../sync/protocol.ts";
import { InMemoryAdapter } from "../adapters/memory.ts";

export class SyncHandler {
  private store = new InMemoryAdapter();
  private initialized = new Set<string>();

  async handle(msg: SyncMessage): Promise<SyncMessage | null> {
    // ensure collection exists
    if (!this.initialized.has(msg.collection)) {
      await this.store.createCollection(msg.collection);
      this.initialized.add(msg.collection);
    }

    switch (msg.type) {
      case "push": {
        for (const doc of (msg as PushMessage).documents) {
          const existing = await this.store.findById(msg.collection, doc._id);
          if (!existing || doc._updatedAt >= existing._updatedAt) {
            if (existing) {
              await this.store.update(msg.collection, doc._id, doc);
            } else {
              await this.store.insert(msg.collection, doc);
            }
          }
        }
        return {
          type: "ack",
          collection: msg.collection,
          ids: (msg as PushMessage).documents.map((d) => d._id),
        } as AckMessage;
      }

      case "pull": {
        const since = (msg as PullMessage).since;
        const docs = await this.store.find(msg.collection, {
          filter: { _updatedAt: { $gt: since } as Record<string, unknown> },
        });
        return {
          type: "pull-response",
          collection: msg.collection,
          documents: docs,
        } as PullResponse;
      }

      case "ack":
        return null;
    }

    return null;
  }

  async close(): Promise<void> {
    await this.store.disconnect();
  }
}
