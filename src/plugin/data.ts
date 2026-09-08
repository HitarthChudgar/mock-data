import type { LayerBinding } from "../shared/messages";

export const NODE_KEY = "payload";
export const ROOT_JSON_KEY = "payload-json";

export type NodePayload =
  | { v: 1; kind: "field"; path: string }
  | { v: 1; kind: "repeat-template"; arrayPath: string; bindings: LayerBinding[]; fillExisting?: boolean }
  | { v: 1; kind: "repeat-instance"; templateId: string; index: number };

export function readPayload(node: BaseNode): NodePayload | null {
  const raw = node.getPluginData(NODE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NodePayload;
  } catch {
    return null;
  }
}

export function writePayload(node: BaseNode, payload: NodePayload): void {
  node.setPluginData(NODE_KEY, JSON.stringify(payload));
}

export function clearPayload(node: BaseNode): void {
  node.setPluginData(NODE_KEY, "");
}

export function readDocumentJsonText(): string {
  return figma.root.getPluginData(ROOT_JSON_KEY);
}

export function writeDocumentJsonText(text: string): void {
  figma.root.setPluginData(ROOT_JSON_KEY, text);
}

export function readDocumentJson(): unknown | null {
  const text = readDocumentJsonText();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function walk(node: BaseNode, visit: (node: BaseNode) => void): void {
  visit(node);
  if ("children" in node) {
    for (const child of node.children) walk(child, visit);
  }
}

export function collectTextNodes(root: SceneNode): TextNode[] {
  if (root.type === "TEXT") return [root];
  const out: TextNode[] = [];
  walk(root, (node) => {
    if (node.type === "TEXT") out.push(node);
  });
  return out;
}

export function ancestorNames(root: SceneNode, target: SceneNode): string[] {
  const names: string[] = [];
  let current: BaseNode = target;
  while (current !== root) {
    if (current.name) names.push(current.name);
    const parentNode = current.parent as BaseNode | null;
    if (!parentNode) break;
    current = parentNode;
  }
  return names;
}

export function getLayerPath(root: SceneNode, target: SceneNode): string {
  const parts: string[] = [];
  let current: BaseNode = target;
  while (current !== root) {
    const parentNode = current.parent as BaseNode | null;
    if (!parentNode || !("children" in parentNode)) break;
    const siblings = parentNode.children;
    const named = siblings.filter((child) => child.name === current.name);
    const index = named.indexOf(current as typeof named[number]);
    parts.unshift(named.length > 1 ? `${current.name}#${index}` : current.name);
    current = parentNode;
  }
  return parts.join("/");
}

export function findByLayerPath(root: SceneNode, path: string): SceneNode | null {
  if (!path) return root;
  let current: SceneNode = root;
  for (const part of path.split("/")) {
    if (!("children" in current)) return null;
    const hash = part.lastIndexOf("#");
    let name = part;
    let nth = 0;
    if (hash > 0 && /^\d+$/.test(part.slice(hash + 1))) {
      name = part.slice(0, hash);
      nth = Number(part.slice(hash + 1));
    }
    const named = current.children.filter((child) => child.name === name);
    const next = named[nth];
    if (!next) return null;
    current = next;
  }
  return current;
}
