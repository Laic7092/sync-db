import type { SyncMessage } from "../sync/protocol.ts";
import { SyncHandler } from "./handler.ts";

export interface WSServerOptions {
  port?: number;
  heartbeat?: number;
}

// minimal WebSocket type for Node.js ws library
interface WebSocketLike {
  send(data: string): void;
  readyState: number;
  on(event: "message", cb: (data: Buffer | string) => void): void;
  on(event: "pong", cb: () => void): void;
  on(event: "close", cb: () => void): void;
  ping(): void;
  terminate(): void;
}

interface WSSLike {
  close(): void;
  on(event: "connection", cb: (ws: WebSocketLike, req: unknown) => void): void;
  on(event: "close", cb: () => void): void;
  clients: Set<WebSocketLike>;
}

export function createWSServer(options: WSServerOptions = {}) {
  const handler = new SyncHandler();
  const clients = new Set<{ ws: WebSocketLike; isAlive: boolean }>();
  let wss: WSSLike | null = null;

  async function start(): Promise<void> {
    const { WebSocketServer } = await import("ws");
    const port = options.port ?? 8080;
    wss = new WebSocketServer({ port }) as unknown as WSSLike;

    wss.on("connection", (ws) => {
      const client = { ws, isAlive: true };
      clients.add(client);

      ws.on("message", async (data) => {
        try {
          const msg = JSON.parse(data.toString()) as SyncMessage;
          const reply = await handler.handle(msg);
          if (reply && ws.readyState === 1) {
            ws.send(JSON.stringify(reply));
          }
        } catch {
          // ignore
        }
      });

      ws.on("pong", () => {
        client.isAlive = true;
      });

      ws.on("close", () => {
        clients.delete(client);
      });
    });

    const interval = options.heartbeat ?? 30000;
    setInterval(() => {
      for (const c of clients) {
        if (!c.isAlive) {
          c.ws.terminate();
          clients.delete(c);
          continue;
        }
        c.isAlive = false;
        c.ws.ping();
      }
    }, interval);

    console.log(`[sync-db] WS server listening on :${port}`);
  }

  function stop(): void {
    for (const c of clients) {
      c.ws.terminate();
    }
    clients.clear();
    wss?.close();
    void handler.close();
  }

  return { start, stop, handler };
}
