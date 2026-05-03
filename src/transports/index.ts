import type { Transport, TransportKind } from "./types.ts";
import { detectEnv } from "../env.ts";

export async function resolveTransport(kind: TransportKind = "auto"): Promise<Transport> {
  if (kind === "http") {
    const { HTTPTransport } = await import("./http.ts");
    return new HTTPTransport();
  }

  if (kind === "ws") {
    const { WebSocketTransport } = await import("./ws.ts");
    return new WebSocketTransport();
  }

  if (kind === "webrtc") {
    const { WebRTCTransport } = await import("./webrtc.ts");
    return new WebRTCTransport();
  }

  // auto: prefer WebSocket, then HTTP
  const env = detectEnv();
  if (env.hasWebRTC) {
    const { WebRTCTransport } = await import("./webrtc.ts");
    return new WebRTCTransport();
  }
  if (env.hasWebSocket) {
    const { WebSocketTransport } = await import("./ws.ts");
    return new WebSocketTransport();
  }

  const { HTTPTransport } = await import("./http.ts");
  return new HTTPTransport();
}

export type { Transport, TransportKind } from "./types.ts";
