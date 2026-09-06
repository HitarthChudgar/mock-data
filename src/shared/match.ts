const ALIAS_GROUPS = [
  ["firm", "name", "investor", "holder", "institution", "organization", "org", "company"],
  ["ownership", "owned", "percent", "pct", "stake", "holding", "weight"],
  ["change", "delta", "chg", "qoq", "variation", "movement"],
  ["shares", "share", "units", "quantity", "qty"],
  ["value", "val", "amount", "aum", "market"],
  ["style", "strategy", "approach"],
  ["ticker", "symbol", "sym"],
  ["sector", "industry"],
  ["marketcap", "mktcap", "cap"],
  ["price", "last", "close"],
  ["email", "mail"],
  ["phone", "tel", "telephone", "mobile"],
  ["title", "role", "position"],
  ["date", "when", "day"],
  ["time"],
  ["status", "state"],
  ["type", "kind", "category"],
  ["region", "geo", "territory"],
  ["location", "venue", "place", "city"],
  ["website", "url", "web"],
  ["ircontact", "contact"],
];

const GENERIC_LAYER = /^(text|layer|frame|group|rectangle|vector|ellipse|line|component|instance|autolayout|placeholder|label|value|heading|body|caption)\d*$/;

export function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isGenericLayerName(name: string): boolean {
  return GENERIC_LAYER.test(normalize(name));
}

export function prettyFieldName(field: string): string {
  const last = field.split(".").pop() ?? field;
  return last
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/(\d+)/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function prettyRowName(arrayPath: string): string {
  const key = arrayPath.replace(/\[\]$/, "").split(".").pop() ?? "Row";
  const singular = key.length > 3 && key.endsWith("s") && !key.endsWith("ss") ? key.slice(0, -1) : key;
  return prettyFieldName(singular);
}

export function tokenize(value: string): string[] {
  const stripped = value.replace(/#\d+$/, "").replace(/\s+\d+$/, "");
  const spaced = stripped
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_.\-/]+/g, " ")
    .trim();
  const parts = spaced.split(/\s+/).map(normalize).filter(Boolean);
  const joined = normalize(stripped);
  const unique = new Set<string>(joined ? [joined, ...parts] : parts);
  return [...unique];
}

function looseContains(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 4) return false;
  return long.includes(short);
}

function aliasScore(layerToken: string, fieldToken: string): number {
  for (const group of ALIAS_GROUPS) {
    if (group.includes(layerToken) && group.includes(fieldToken)) return 88;
  }
  return 0;
}

export function matchScore(candidates: string[], field: string): number {
  const useful = candidates.filter((name) => name && !isGenericLayerName(name));
  const pool = useful.length > 0 ? useful : candidates;
  const layerTokens = pool.flatMap(tokenize);
  if (layerTokens.length === 0) return 0;

  const fieldParts = field.split(".");
  const fieldTokens = fieldParts.flatMap(tokenize);
  const last = fieldTokens[fieldTokens.length - 1] ?? "";
  const compactField = normalize(field.replace(/\./g, ""));

  let best = 0;
  if (compactField && layerTokens.includes(compactField)) best = Math.max(best, 110);

  for (const layer of layerTokens) {
    if (!layer) continue;
    if (layer === last) {
      const parentHits = fieldTokens.slice(0, -1).filter((part) => layerTokens.includes(part)).length;
      best = Math.max(best, 100 + parentHits * 8);
    }
    for (const fieldToken of fieldTokens) {
      if (layer === fieldToken) best = Math.max(best, 100);
      else if (looseContains(layer, fieldToken)) best = Math.max(best, 70);
      best = Math.max(best, aliasScore(layer, fieldToken));
    }
  }

  return best;
}

export function pickField(candidates: string[], fields: string[]): { field: string; score: number } | null {
  let best: { field: string; score: number } | null = null;
  for (const field of fields) {
    const score = matchScore(candidates, field);
    if (score < 50) continue;
    if (!best || score > best.score) best = { field, score };
  }
  return best;
}
