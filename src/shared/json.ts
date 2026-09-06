export type PathPart =
  | { type: "key"; value: string }
  | { type: "index"; value: number }
  | { type: "wild" };

export type JsonTreeNode = {
  path: string;
  key: string;
  kind: "object" | "array" | "value";
  valueType: string;
  preview: string;
  count?: number;
  fields?: { key: string; path: string; preview: string }[];
  children: JsonTreeNode[];
};

export type ObjectArrayInfo = {
  path: string;
  count: number;
  fields: string[];
};

export function parsePath(path: string): PathPart[] {
  if (!path) return [];
  const parts: PathPart[] = [];
  let i = 0;
  while (i < path.length) {
    const ch = path[i];
    if (ch === ".") {
      i += 1;
      continue;
    }
    if (ch === "[") {
      const end = path.indexOf("]", i);
      if (end === -1) break;
      const inner = path.slice(i + 1, end);
      if (inner === "") parts.push({ type: "wild" });
      else parts.push({ type: "index", value: Number(inner) });
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < path.length && path[j] !== "." && path[j] !== "[") j += 1;
    const key = path.slice(i, j);
    if (key) parts.push({ type: "key", value: key });
    i = j;
  }
  return parts;
}

export function joinPath(base: string, next: string | number): string {
  if (typeof next === "number") {
    return `${base}[${next}]`;
  }
  if (!base) return next;
  return `${base}.${next}`;
}

export function arrayPath(base: string): string {
  return `${base}[]`;
}

export function concretizePath(path: string): string {
  return path.replace(/\[\]/g, "[0]");
}

export function getAtPath(data: unknown, path: string): unknown {
  const parts = parsePath(path);
  let current = data;
  for (const part of parts) {
    if (current == null) return undefined;
    if (part.type === "wild") {
      if (!Array.isArray(current)) return undefined;
      current = current[0];
      continue;
    }
    if (part.type === "index") {
      if (!Array.isArray(current)) return undefined;
      current = current[part.value];
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part.value];
  }
  return current;
}

export function getArrayAtPath(data: unknown, path: string): unknown[] | null {
  const value = path === "" || path === "[]" ? data : getAtPath(data, path.replace(/\[\]$/, ""));
  return Array.isArray(value) ? value : null;
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === "object") return "object";
  return String(value);
}

export function formatPreview(value: unknown, max = 42): string {
  const text = formatValue(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  const keys: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      keys.push(...flattenKeys(child, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

export function parseJsonText(text: string): { ok: true; data: unknown } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Paste JSON to get started." };
  try {
    return { ok: true, data: JSON.parse(trimmed) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { ok: false, error: message.replace(/^JSON\.parse: /, "") };
  }
}

function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function objectFields(item: unknown, basePath: string): { key: string; path: string; preview: string }[] {
  if (!item || typeof item !== "object" || Array.isArray(item)) return [];
  return flattenKeys(item).map((key) => ({
    key,
    path: `${basePath}[].${key}`,
    preview: formatPreview(getAtPath(item, key)),
  }));
}

export function buildTree(data: unknown, path = "", key = "root"): JsonTreeNode {
  if (Array.isArray(data)) {
    const first = data[0];
    const children = data.slice(0, 20).map((item, index) =>
      buildTree(item, joinPath(path, index), `[${index}]`),
    );
    if (data.length > 20) {
      children.push({
        path: joinPath(path, 20),
        key: `+${data.length - 20} more`,
        kind: "value",
        valueType: "more",
        preview: "",
        children: [],
      });
    }
    return {
      path: path ? arrayPath(path) : "[]",
      key: path ? `${key}[]` : "[]",
      kind: "array",
      valueType: "array",
      preview: `${data.length}`,
      count: data.length,
      fields: objectFields(first, path),
      children,
    };
  }

  if (data && typeof data === "object") {
    const children = Object.entries(data).map(([childKey, childValue]) =>
      buildTree(childValue, joinPath(path, childKey), childKey),
    );
    return {
      path,
      key,
      kind: "object",
      valueType: "object",
      preview: `${children.length} fields`,
      children,
    };
  }

  return {
    path,
    key,
    kind: "value",
    valueType: valueType(data),
    preview: formatPreview(data),
    children: [],
  };
}

export function findObjectArrays(data: unknown, path = ""): ObjectArrayInfo[] {
  const found: ObjectArrayInfo[] = [];

  if (Array.isArray(data)) {
    const first = data.find((item) => item && typeof item === "object" && !Array.isArray(item));
    if (first && typeof first === "object") {
      found.push({
        path: path || "[]",
        count: data.length,
        fields: flattenKeys(first),
      });
    }
    data.slice(0, 8).forEach((item, index) => {
      found.push(...findObjectArrays(item, joinPath(path, index)));
    });
    return found;
  }

  if (data && typeof data === "object") {
    for (const [key, value] of Object.entries(data)) {
      found.push(...findObjectArrays(value, joinPath(path, key)));
    }
  }

  return found;
}

export function summarizeJson(data: unknown): string {
  const arrays = findObjectArrays(data);
  if (arrays.length === 1) {
    const [only] = arrays;
    const label = only.path === "[]" ? "items" : only.path.replace(/\[\]$/, "");
    return `${label}[] · ${only.count}`;
  }
  if (arrays.length > 1) {
    return arrays.map((item) => `${item.path.replace(/\[\]$/, "")}[] ${item.count}`).join(" · ");
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return `${Object.keys(data).length} fields`;
  }
  return "JSON ready";
}

export function pickDefaultArrayPath(data: unknown): string | null {
  const arrays = findObjectArrays(data);
  if (arrays.length === 1) return arrays[0].path;
  const preferred = arrays.find((item) =>
    /investors|holdings|contacts|events|companies|institutions/i.test(item.path),
  );
  return preferred?.path ?? null;
}
