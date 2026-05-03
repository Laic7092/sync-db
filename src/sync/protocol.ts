import type { InternalDocument } from "../adapters/types.ts";

export interface PushMessage {
  type: "push";
  collection: string;
  documents: InternalDocument[];
}

export interface PullMessage {
  type: "pull";
  collection: string;
  since: number;
}

export interface PullResponse {
  type: "pull-response";
  collection: string;
  documents: InternalDocument[];
}

export interface AckMessage {
  type: "ack";
  collection: string;
  ids: string[];
}

export type SyncMessage = PushMessage | PullMessage | PullResponse | AckMessage;
