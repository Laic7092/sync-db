import type { SyncMessage } from "../sync/protocol.ts";

export interface Transport {
  readonly name: string;

  connect(url: string): Promise<void>;
  disconnect(): Promise<void>;
  readonly connected: boolean;

  send(message: SyncMessage): Promise<void>;

  onMessage(handler: (msg: SyncMessage) => void): () => void;
  onConnect(handler: () => void): () => void;
  onDisconnect(handler: () => void): () => void;
}

export type TransportKind = "auto" | "ws" | "http";
