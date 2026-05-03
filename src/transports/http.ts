import type { Transport } from "./types.ts";
import type { SyncMessage } from "../sync/protocol.ts";

export class HTTPTransport implements Transport {
  readonly name = "http";
  connected = false;
  private baseUrl = "";
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private messageHandlers = new Set<(msg: SyncMessage) => void>();
  private connectHandlers = new Set<() => void>();
  private disconnectHandlers = new Set<() => void>();
  private pollInterval = 5000;

  async connect(url: string): Promise<void> {
    this.baseUrl = url.replace(/\/$/, "");
    this.connected = true;
    for (const h of this.connectHandlers) h();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const h of this.disconnectHandlers) h();
  }

  async send(message: SyncMessage): Promise<void> {
    if (!this.connected || !this.baseUrl) return;
    try {
      await fetch(`${this.baseUrl}/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(message),
      });
    } catch {
      this.emitDisconnect();
    }
  }

  startPolling(since: number, collections: string[]): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(async () => {
      if (!this.connected) return;
      for (const col of collections) {
        try {
          const resp = await fetch(
            `${this.baseUrl}/sync?collection=${encodeURIComponent(col)}&since=${since}`,
          );
          if (!resp.ok) continue;
          const msg = (await resp.json()) as SyncMessage;
          if (msg.type === "pull-response" && msg.documents?.length) {
            for (const h of this.messageHandlers) h(msg);
            since = Math.max(...msg.documents.map((d) => d._updatedAt), since);
          }
        } catch {
          this.emitDisconnect();
        }
      }
    }, this.pollInterval);
  }

  onMessage(handler: (msg: SyncMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onConnect(handler: () => void): () => void {
    this.connectHandlers.add(handler);
    return () => {
      this.connectHandlers.delete(handler);
    };
  }

  onDisconnect(handler: () => void): () => void {
    this.disconnectHandlers.add(handler);
    return () => {
      this.disconnectHandlers.delete(handler);
    };
  }

  private emitDisconnect(): void {
    this.connected = false;
    for (const h of this.disconnectHandlers) h();
  }
}
