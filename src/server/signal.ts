export interface SignalServerOptions {
  port?: number;
  heartbeat?: number;
}

interface WebSocketLike {
  send(data: string): void;
  readyState: number;
  on(event: "message", cb: (data: Buffer | string) => void): void;
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

export function createSignalServer(options: SignalServerOptions = {}) {
  const rooms = new Map<string, { peers: Map<string, { ws: WebSocketLike; peerId: string }> }>();
  const port = options.port ?? 8081;
  let wss: WSSLike | null = null;
  let pingTimer: ReturnType<typeof setInterval>;

  async function start(): Promise<void> {
    const { WebSocketServer } = await import("ws");
    wss = new WebSocketServer({ port }) as unknown as WSSLike;

    wss.on("connection", (ws) => {
      let peerId = "";
      let roomName = "";

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as Record<string, unknown>;

          switch (msg.type) {
            case "join": {
              peerId = msg.peerId as string;
              roomName = msg.room as string;
              if (!rooms.has(roomName)) rooms.set(roomName, { peers: new Map() });
              const room = rooms.get(roomName)!;

              for (const [id, peer] of room.peers) {
                peer.ws.send(JSON.stringify({ type: "peer-joined", peerId }));
                ws.send(JSON.stringify({ type: "peer-joined", peerId: id }));
              }
              room.peers.set(peerId, { ws, peerId });
              break;
            }
            case "offer":
            case "answer":
            case "ice": {
              const room = rooms.get(roomName);
              if (!room) return;
              const target = room.peers.get(msg.to as string);
              if (target) {
                target.ws.send(JSON.stringify({ ...msg, from: peerId }));
              }
              break;
            }
          }
        } catch {
          // ignore
        }
      });

      ws.on("close", () => {
        const room = rooms.get(roomName);
        if (room) {
          room.peers.delete(peerId);
          for (const [, peer] of room.peers) {
            peer.ws.send(JSON.stringify({ type: "peer-left", peerId }));
          }
          if (room.peers.size === 0) rooms.delete(roomName);
        }
      });
    });

    const interval = options.heartbeat ?? 30000;
    pingTimer = setInterval(() => {
      for (const [, room] of rooms) {
        for (const [, peer] of room.peers) {
          if (peer.ws.readyState === 1) peer.ws.ping();
        }
      }
    }, interval);

    console.log(`[sync-db] Signal server listening on :${port}`);
  }

  function stop(): void {
    clearInterval(pingTimer);
    rooms.clear();
    wss?.close();
  }

  return { start, stop };
}
