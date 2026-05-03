export interface EnvInfo {
  runtime: "browser" | "node" | "unknown";
  hasIndexedDB: boolean;
  hasWebSocket: boolean;
  hasWebRTC: boolean;
  hasCrypto: boolean;
}

export function detectEnv(): EnvInfo {
  const g = globalThis as Record<string, unknown>;

  const isBrowser = typeof g.window !== "undefined" && typeof g.document !== "undefined";

  let isNode = false;
  try {
    const proc = g.process as Record<string, unknown> | undefined;
    if (proc) {
      const versions = proc.versions as Record<string, unknown> | undefined;
      isNode = typeof versions?.node === "string";
    }
  } catch {
    // not node
  }

  return {
    runtime: isBrowser ? "browser" : isNode ? "node" : "unknown",
    hasIndexedDB: typeof g.indexedDB !== "undefined",
    hasWebSocket: typeof g.WebSocket !== "undefined",
    hasWebRTC: typeof g.RTCPeerConnection !== "undefined",
    hasCrypto:
      typeof g.crypto !== "undefined" &&
      typeof (g.crypto as { randomUUID?: unknown }).randomUUID === "function",
  };
}
