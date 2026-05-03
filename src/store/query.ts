import type { Filter, InternalDocument, Query } from "../types.ts";

function isFilterOperator(v: unknown): boolean {
  if (v === null || typeof v !== "object") return false;
  const keys = Object.keys(v as object);
  return keys.length > 0 && keys.every((k) => k.startsWith("$"));
}

function matchValue(docVal: unknown, filterVal: unknown): boolean {
  if (isFilterOperator(filterVal)) {
    const op = filterVal as Record<string, unknown>;
    for (const key of Object.keys(op)) {
      switch (key) {
        case "$eq":
          if (docVal !== op.$eq) return false;
          break;
        case "$ne":
          if (docVal === op.$ne) return false;
          break;
        case "$gt":
          if (!(typeof docVal === "number" && docVal > (op.$gt as number))) return false;
          break;
        case "$gte":
          if (!(typeof docVal === "number" && docVal >= (op.$gte as number))) return false;
          break;
        case "$lt":
          if (!(typeof docVal === "number" && docVal < (op.$lt as number))) return false;
          break;
        case "$lte":
          if (!(typeof docVal === "number" && docVal <= (op.$lte as number))) return false;
          break;
        case "$in": {
          const arr = op.$in as unknown[];
          if (!arr.includes(docVal)) return false;
          break;
        }
        case "$nin": {
          const arr = op.$nin as unknown[];
          if (arr.includes(docVal)) return false;
          break;
        }
        case "$regex": {
          const re = typeof op.$regex === "string" ? new RegExp(op.$regex) : (op.$regex as RegExp);
          if (typeof docVal !== "string" || !re.test(docVal)) return false;
          break;
        }
        case "$exists":
          if (op.$exists && docVal === undefined) return false;
          if (!op.$exists && docVal !== undefined) return false;
          break;
      }
    }
    return true;
  }
  return docVal === filterVal;
}

export function matchDocument(doc: InternalDocument, filter: Filter): boolean {
  for (const [key, val] of Object.entries(filter)) {
    if (key === "$or") {
      const clauses = val as Filter[];
      if (!clauses.some((f) => matchDocument(doc, f))) return false;
      continue;
    }
    if (key === "$and") {
      const clauses = val as Filter[];
      if (!clauses.every((f) => matchDocument(doc, f))) return false;
      continue;
    }
    if (!matchValue(doc[key], val)) return false;
  }
  return true;
}

export function applySort(
  docs: InternalDocument[],
  sort: Record<string, "asc" | "desc">,
): InternalDocument[] {
  const entries = Object.entries(sort);
  if (entries.length === 0) return docs;
  return [...docs].sort((a, b) => {
    for (const [key, dir] of entries) {
      const av = a[key] as number | string | undefined;
      const bv = b[key] as number | string | undefined;
      if (av === bv) continue;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

export function executeQuery(docs: InternalDocument[], query: Query): InternalDocument[] {
  let result = docs;

  if (query.filter) {
    result = result.filter((d) => matchDocument(d, query.filter!));
  }

  if (query.sort) {
    result = applySort(result, query.sort);
  }

  if (query.skip != null) {
    result = result.slice(query.skip);
  }

  if (query.limit != null) {
    result = result.slice(0, query.limit);
  }

  return result;
}
