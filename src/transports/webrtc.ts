import type { Transport } from "./types.ts";
import type { SyncMessage } from "../sync/protocol.ts";

interface SignalChannel {
  send(data: string): void;
  onMessage(handler: (data: string) => void): () => void;
}

interface PeerConn {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  id: string;
  polite: boolean;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export class WebRTCTransport implements Transport {
  readonly name = "webrtc";
  connected = false;
  private peers = new Map<string, PeerConn>();
  private signal: SignalChannel | null = null;
  private room = "";
  private peerId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  private messageHandlers = new Set<(msg: SyncMessage) => void>();
  private connectHandlers = new Set<() => void>();
  private disconnectHandlers = new Set<() => void>();
  private unsub: (() => void) | null = null;

  async connect(signalUrl: string): Promise<void> {
    // signalUrl format: "ws://host:port/room-name"
    const url = new URL(signalUrl);
    this.room = url.pathname.replace(/^\//, "") || "default";

    const ws = new WebSocket(signalUrl);
    this.signal = {
      send(data: string) {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      },
      onMessage(handler: (data: string) => void) {
        const cb = (e: MessageEvent) => handler(e.data as string);
        ws.addEventListener("message", cb);
        return () => ws.removeEventListener("message", cb);
      },
    };

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Signaling connection failed"));
    });

    // join room
    this.signal.send(JSON.stringify({ type: "join", room: this.room, peerId: this.peerId }));

    this.unsub = this.signal.onMessage(async (raw) => {
      const msg = JSON.parse(raw) as Record<string, unknown>;
      await this.handleSignal(msg);
    });

    this.connected = true;
    for (const h of this.connectHandlers) h();
  }

  private async handleSignal(msg: Record<string, unknown>): Promise<void> {
    switch (msg.type) {
      case "peer-joined": {
        const remoteId = msg.peerId as string;
        if (remoteId === this.peerId) return;
        await this.createPeer(remoteId, true);
        // create and send offer
        const offer = await this.peers.get(remoteId)!.pc.createOffer();
        await this.peers.get(remoteId)!.pc.setLocalDescription(offer);
        this.signal!.send(JSON.stringify({ type: "offer", to: remoteId, offer }));
        break;
      }
      case "offer": {
        const remoteId = msg.from as string;
        await this.createPeer(remoteId, false);
        const pc = this.peers.get(remoteId)!.pc;
        await pc.setRemoteDescription(
          new RTCSessionDescription(msg.offer as RTCSessionDescriptionInit),
        );
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.signal!.send(JSON.stringify({ type: "answer", to: remoteId, answer }));
        break;
      }
      case "answer": {
        const remoteId = msg.from as string;
        const pc = this.peers.get(remoteId)?.pc;
        if (pc && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(
            new RTCSessionDescription(msg.answer as RTCSessionDescriptionInit),
          );
        }
        break;
      }
      case "ice": {
        const remoteId = msg.from as string;
        const pc = this.peers.get(remoteId)?.pc;
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
        }
        break;
      }
      case "peer-left": {
        const remoteId = msg.peerId as string;
        const conn = this.peers.get(remoteId);
        if (conn) {
          conn.pc.close();
          this.peers.delete(remoteId);
        }
        break;
      }
    }
  }

  private async createPeer(remoteId: string, polite: boolean): Promise<void> {
    if (this.peers.has(remoteId)) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    const conn: PeerConn = { pc, dc: null, id: remoteId, polite };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.signal!.send(
          JSON.stringify({
            type: "ice",
            to: remoteId,
            candidate: e.candidate.toJSON(),
          }),
        );
      }
    };

    pc.ondatachannel = (e) => {
      conn.dc = e.channel;
      this.setupDataChannel(conn.dc, remoteId);
    };

    if (polite) {
      const dc = pc.createDataChannel("sync");
      conn.dc = dc;
      this.setupDataChannel(dc, remoteId);
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        this.peers.delete(remoteId);
        pc.close();
      }
    };

    this.peers.set(remoteId, conn);
  }

  private setupDataChannel(dc: RTCDataChannel, remoteId: string): void {
    dc.onopen = () => {
      for (const h of this.connectHandlers) h();
    };

    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as SyncMessage;
        for (const h of this.messageHandlers) h(msg);
      } catch {
        // ignore
      }
    };

    dc.onclose = () => {
      const conn = this.peers.get(remoteId);
      if (conn) conn.dc = null;
    };
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.unsub?.();
    for (const [, conn] of this.peers) {
      conn.dc?.close();
      conn.pc.close();
    }
    this.peers.clear();
    for (const h of this.disconnectHandlers) h();
  }

  async send(message: SyncMessage): Promise<void> {
    const data = JSON.stringify(message);
    for (const [, conn] of this.peers) {
      if (conn.dc?.readyState === "open") {
        conn.dc.send(data);
      }
    }
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
