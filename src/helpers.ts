let _hasCrypto: boolean | null = null;

function hasCrypto(): boolean {
  if (_hasCrypto !== null) return _hasCrypto;
  _hasCrypto = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function";
  return _hasCrypto;
}

export function generateId(): string {
  if (hasCrypto()) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function timestamp(): number {
  return Date.now();
}
