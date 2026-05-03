import type { Transport } from "./types.ts";
import type { SyncMessage } from "../sync/protocol.ts";

export class WebSocketTransport implements Transport {
  readonly name = "ws";
  connected = false;
  private ws: WebSocket | null = null;
  private url = "";
  private messageHandlers = new Set<(msg: SyncMessage) => void>();
  private connectHandlers = new Set<() => void>();
  private disconnectHandlers = new Set<() => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;

  async connect(url: string): Promise<void> {
    this.url = url;
    await this.open();
  }

  private async open(): Promise<void> {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.connected = true;
      for (const h of this.connectHandlers) h();
    };
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as SyncMessage;
        for (const h of this.messageHandlers) h(msg);
      } catch {
        // ignore unparsable messages
      }
    };
    this.ws.onclose = () => {
      this.connected = false;
      for (const h of this.disconnectHandlers) h();
      this.scheduleReconnect();
    };
    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.connected) void this.open();
    }, this.reconnectDelay);
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  async send(message: SyncMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
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
}
