import type { LayerBinding, MappingPreview, SelectionInfo } from "../shared/messages";
import {
  concretizePath,
  flattenKeys,
  formatPreview,
  formatValue,
  getArrayAtPath,
  getAtPath,
  pickDefaultArrayPath,
} from "../shared/json";
import { isGenericLayerName, matchScore, prettyFieldName, prettyRowName } from "../shared/match";
import {
  ancestorNames,
  clearPayload,
  collectTextNodes,
  findByLayerPath,
  getLayerPath,
  readDocumentJson,
  readPayload,
  walk,
  writePayload,
} from "./data";

const REPEATABLE = new Set(["FRAME", "GROUP", "INSTANCE", "SECTION"]);

function layerCandidates(root: SceneNode, text: TextNode): string[] {
  const names = ancestorNames(root, text);
  const path = getLayerPath(root, text);
  const fromPath = path.split("/").map((part) => part.replace(/#\d+$/, ""));
  const content = text.characters.trim();
  const extras = content.length > 0 && content.length <= 32 ? [content] : [];
  return [...names, ...fromPath, ...extras];
}

function displayLayerName(root: SceneNode, text: TextNode): string {
  const names = ancestorNames(root, text);
  return names.find((name) => !isGenericLayerName(name)) ?? text.name;
}

function visualOrder(nodes: TextNode[]): TextNode[] {
  return [...nodes].sort((a, b) => {
    const ay = a.absoluteTransform[1][2];
    const ax = a.absoluteTransform[0][2];
    const by = b.absoluteTransform[1][2];
    const bx = b.absoluteTransform[0][2];
    if (Math.abs(ay - by) > 6) return ay - by;
    return ax - bx;
  });
}

function trySetName(node: BaseNode, name: string): void {
  if (node.name === name) return;
  try {
    node.name = name;
  } catch {
    // Locked layers and some instance internals cannot be renamed.
  }
}

function renameMappedLayers(
  template: SceneNode,
  assigned: { text: TextNode; field: string }[],
  arrayPath?: string,
): void {
  if (arrayPath && isGenericLayerName(template.name)) {
    trySetName(template, prettyRowName(arrayPath));
  }
  for (const { text, field } of assigned) {
    const pretty = prettyFieldName(field);
    trySetName(text, pretty);
    const parent = text.parent as BaseNode | null;
    if (
      parent &&
      parent !== template &&
      parent.type !== "INSTANCE" &&
      parent.type !== "COMPONENT" &&
      "children" in parent
    ) {
      const nested = collectTextNodes(parent as SceneNode);
      if (nested.length === 1 && nested[0].id === text.id && isGenericLayerName(parent.name)) {
        trySetName(parent, pretty);
      }
    }
  }
}

function assignFields(template: SceneNode, item: unknown): { text: TextNode; field: string }[] {
  const fields = flattenKeys(item);
  const texts = visualOrder(collectTextNodes(template));
  const usedFields = new Set<string>();
  const usedNodes = new Set<string>();
  const assigned: { text: TextNode; field: string }[] = [];

  const take = (text: TextNode, field: string) => {
    if (usedNodes.has(text.id) || usedFields.has(field)) return;
    usedNodes.add(text.id);
    usedFields.add(field);
    assigned.push({ text, field });
  };

  const scored: { text: TextNode; field: string; score: number }[] = [];
  for (const text of texts) {
    const candidates = layerCandidates(template, text);
    for (const field of fields) {
      const score = matchScore(candidates, field);
      if (score >= 70) scored.push({ text, field, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  for (const entry of scored) take(entry.text, entry.field);

  for (const text of texts) {
    if (usedNodes.has(text.id)) continue;
    const content = text.characters.trim();
    if (!content) continue;
    for (const field of fields) {
      if (usedFields.has(field)) continue;
      if (content === formatValue(getAtPath(item, field))) {
        take(text, field);
        break;
      }
    }
  }

  const leftoverTexts = texts.filter((text) => !usedNodes.has(text.id));
  const leftoverFields = fields.filter((field) => !usedFields.has(field));
  const bindable =
    leftoverTexts.length >= leftoverFields.length * 2 && leftoverFields.length > 0
      ? leftoverTexts.filter((_, index) => index % 2 === 1).concat(leftoverTexts.filter((_, index) => index % 2 === 0))
      : leftoverTexts;

  const limit = Math.min(bindable.length, leftoverFields.length);
  for (let i = 0; i < limit; i += 1) {
    take(bindable[i], leftoverFields[i]);
  }

  return assigned;
}

export function autoMap(
  template: SceneNode,
  item: unknown,
  options: { rename?: boolean; arrayPath?: string } = {},
): LayerBinding[] {
  const assigned = assignFields(template, item);
  if (options.rename) renameMappedLayers(template, assigned, options.arrayPath);
  return assigned.map(({ text, field }) => ({
    layerPath: getLayerPath(template, text),
    field,
  }));
}

export function mappingPreviews(template: SceneNode, item: unknown, bindings: LayerBinding[]): MappingPreview[] {
  const byPath = new Map(bindings.map((binding) => [binding.layerPath, binding.field]));
  return collectTextNodes(template).map((text) => {
    const layerPath = getLayerPath(template, text);
    const field = byPath.get(layerPath) ?? null;
    return {
      layerName: displayLayerName(template, text),
      layerPath,
      field,
      preview: field ? formatPreview(getAtPath(item, field)) : "",
    };
  });
}

function isRepeatableNode(node: SceneNode): boolean {
  return REPEATABLE.has(node.type) && collectTextNodes(node).length > 0;
}

function similarRowName(name: string): string {
  return name.replace(/\s+\d+$/, "").trim();
}

function looksLikeList(children: SceneNode[]): boolean {
  if (children.length < 2) return false;
  const names = children.map((child) => similarRowName(child.name));
  return Boolean(names[0] && names.every((name) => name === names[0]));
}

function textCount(node: SceneNode): number {
  return collectTextNodes(node).length;
}

function rowChildren(node: BaseNode): SceneNode[] {
  if (!("children" in node)) return [];
  const rows: SceneNode[] = [];
  for (const child of node.children) {
    if (child.type === "TEXT" || child.type === "PAGE") continue;
    const scene = child as SceneNode;
    if (isRepeatableNode(scene)) rows.push(scene);
  }
  return rows;
}

function similarTextCounts(nodes: SceneNode[]): boolean {
  if (nodes.length < 2) return false;
  const counts = nodes.map(textCount);
  const first = counts[0];
  return counts.every((count) => count === first && count > 0);
}

function isRepeatingList(node: BaseNode): boolean {
  if (!REPEATABLE.has((node as SceneNode).type)) return false;
  const frames = rowChildren(node);
  if (frames.length < 2) return false;
  const existing = frames.filter((child) => {
    const payload = readPayload(child);
    return payload?.kind === "repeat-template" || payload?.kind === "repeat-instance";
  });
  if (existing.length >= 1 && frames.length >= 2) return true;
  return (looksLikeList(frames) || similarTextCounts(frames)) && frames.every((child) => textCount(child) >= 2);
}

function firstRowInList(list: SceneNode): SceneNode {
  const frames = rowChildren(list);
  const existing = frames.find((child) => readPayload(child)?.kind === "repeat-template");
  return existing ?? frames[0] ?? list;
}

function parentScene(node: BaseNode): SceneNode | null {
  const parent = node.parent as BaseNode | null;
  if (!parent || parent.type === "PAGE" || parent.type === "DOCUMENT" || parent.type === "SECTION") {
    return null;
  }
  return parent as SceneNode;
}

function childCount(node: BaseNode): number {
  return "children" in node ? node.children.length : 0;
}

function shouldLiftFragment(node: SceneNode): boolean {
  const parent = parentScene(node);
  if (!parent || isRepeatingList(parent)) return false;
  if (!REPEATABLE.has(parent.type)) return false;
  const extra = textCount(parent) - textCount(node);
  return extra > 0 && extra <= 6 && childCount(parent) <= 6;
}

export function resolveRepeatTarget(node: SceneNode): SceneNode {
  let current: SceneNode = node;
  if (current.type === "TEXT" || !REPEATABLE.has(current.type)) {
    const parent = parentScene(current);
    if (!parent) return current;
    current = parent;
  }

  if (isRepeatingList(current)) {
    current = firstRowInList(current);
  }

  while (shouldLiftFragment(current)) {
    const parent = parentScene(current);
    if (!parent) break;
    current = parent;
  }

  return current;
}

async function loadFonts(node: TextNode): Promise<boolean> {
  try {
    if (node.characters.length === 0) {
      if (node.fontName === figma.mixed) {
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        node.fontName = { family: "Inter", style: "Regular" };
      } else {
        await figma.loadFontAsync(node.fontName);
      }
      return true;
    }
    const fonts = node.getRangeAllFontNames(0, node.characters.length);
    await Promise.all(fonts.map((font) => figma.loadFontAsync(font)));
    return true;
  } catch {
    return false;
  }
}

export async function setText(node: TextNode, value: string): Promise<boolean> {
  const loaded = await loadFonts(node);
  if (!loaded) return false;
  node.characters = value;
  return true;
}

export async function populateField(node: TextNode, data: unknown, path: string): Promise<boolean> {
  const value = getAtPath(data, concretizePath(path));
  return setText(node, formatValue(value));
}

export async function populateRow(row: SceneNode, item: unknown, bindings: LayerBinding[]): Promise<number> {
  let updated = 0;
  for (const binding of bindings) {
    const node = findByLayerPath(row, binding.layerPath);
    if (!node || node.type !== "TEXT") continue;
    const ok = await setText(node, formatValue(getAtPath(item, binding.field)));
    if (ok) updated += 1;
  }
  return updated;
}

function requireData(): unknown {
  const data = readDocumentJson();
  if (data == null) throw new Error("Add content first — paste JSON or pick a sample.");
  return data;
}

function requireSingle(): SceneNode {
  const nodes = figma.currentPage.selection;
  if (nodes.length === 0) throw new Error("Select a layer on the canvas.");
  if (nodes.length > 1) throw new Error("Select one layer or row at a time.");
  return nodes[0];
}

function parentOf(node: SceneNode): BaseNode & ChildrenMixin {
  const parent = node.parent;
  if (!parent || !("insertChild" in parent)) {
    throw new Error("This layer isn’t inside a frame, so new rows can’t be added.");
  }
  if (parent.type === "INSTANCE") {
    throw new Error("Detach this instance, or generate from a frame instead.");
  }
  return parent;
}

const ROW_GAP = 16;

function siblingRows(template: SceneNode): SceneNode[] {
  const parent = template.parent;
  if (!parent || !("children" in parent) || parent.type === "PAGE" || parent.type === "DOCUMENT") {
    return [template];
  }
  const frames = rowChildren(parent);
  if (!frames.some((row) => row.id === template.id)) return [template];
  const count = textCount(template);
  const peers = frames.filter((row) => textCount(row) === count);
  if (peers.length < 2) return [template];
  if (!looksLikeList(peers) && !similarTextCounts(peers) && !isRepeatingList(parent)) {
    return [template];
  }
  return [...peers].sort((a, b) => parent.children.indexOf(a) - parent.children.indexOf(b));
}

function shouldFillExisting(template: SceneNode): boolean {
  const payload = readPayload(template);
  if (payload?.kind === "repeat-template" && payload.fillExisting) return true;
  const parent = template.parent;
  if (!parent || !("children" in parent)) return false;
  const managed = findInstances(parent, template.id).length > 0;
  return siblingRows(template).length >= 2 && !managed;
}

function findInstances(parent: BaseNode & ChildrenMixin, templateId: string): SceneNode[] {
  return parent.children.filter((child) => {
    const payload = readPayload(child);
    return payload?.kind === "repeat-instance" && payload.templateId === templateId;
  });
}

function isAutoLayoutParent(
  node: BaseNode,
): node is BaseNode & ChildrenMixin & { layoutMode: "HORIZONTAL" | "VERTICAL" | "GRID"; itemSpacing: number } {
  return "layoutMode" in node && node.layoutMode !== "NONE" && node.layoutMode !== undefined;
}

function generatedRows(template: SceneNode, parent: BaseNode & ChildrenMixin): SceneNode[] {
  const rows = [template, ...findInstances(parent, template.id)];
  rows.sort((a, b) => parent.children.indexOf(a) - parent.children.indexOf(b));
  return rows;
}

function setAbsolutePosition(node: SceneNode, absX: number, absY: number): void {
  const parent = node.parent;
  if (!parent || parent.type === "PAGE" || parent.type === "DOCUMENT") {
    if ("x" in node) {
      node.x = absX;
      node.y = absY;
    }
    return;
  }
  if (!("absoluteTransform" in parent) || !("x" in node)) return;
  node.x = absX - parent.absoluteTransform[0][2];
  node.y = absY - parent.absoluteTransform[1][2];
}

function spaceGeneratedRows(template: SceneNode, parent: BaseNode & ChildrenMixin): void {
  const rows = generatedRows(template, parent);
  if (rows.length === 0) return;

  for (const row of rows) {
    if ("layoutPositioning" in row && row.layoutPositioning === "ABSOLUTE") {
      row.layoutPositioning = "AUTO";
    }
  }

  if (isAutoLayoutParent(parent) && parent.layoutMode !== "GRID") {
    if (parent.itemSpacing < ROW_GAP) parent.itemSpacing = ROW_GAP;
  } else if (rows.length > 1 && "absoluteTransform" in template && "height" in template) {
    const absX = template.absoluteTransform[0][2];
    let absY = template.absoluteTransform[1][2] + template.height + ROW_GAP;
    for (const row of rows) {
      if (row === template) continue;
      if ("constraints" in row) {
        row.constraints = { horizontal: "MIN", vertical: "MIN" };
      }
      setAbsolutePosition(row, absX, absY);
      if ("height" in row) absY += row.height + ROW_GAP;
    }
  }

  for (const row of rows) {
    row.visible = true;
  }
}

function duplicateRow(template: SceneNode, parent: BaseNode & ChildrenMixin, index: number): SceneNode {
  if (template.type === "COMPONENT" || template.type === "COMPONENT_SET") {
    throw new Error("Select a frame or instance — not the main component.");
  }
  const copy = template.clone();
  copy.visible = false;
  if ("layoutPositioning" in copy && copy.layoutPositioning === "ABSOLUTE") {
    copy.layoutPositioning = "AUTO";
  }
  parent.insertChild(Math.min(index, parent.children.length), copy);
  return copy;
}

export async function bindSelectedField(path: string): Promise<SelectionInfo> {
  const node = requireSingle();
  if (node.type !== "TEXT") {
    throw new Error("Select a text layer to fill it.");
  }
  const data = requireData();
  const concrete = concretizePath(path);
  writePayload(node, { v: 1, kind: "field", path: concrete });
  await populateField(node, data, concrete);
  return inspectSelection();
}

function resolveTemplate(node: SceneNode): SceneNode {
  const payload = readPayload(node);
  if (payload?.kind !== "repeat-instance") return node;
  const parent = node.parent;
  if (parent && "children" in parent) {
    const template = parent.children.find((child) => child.id === payload.templateId);
    if (template) return template;
  }
  return siblingRows(node)[0] ?? node;
}

function resolveArrayPath(requested: string | undefined, template: SceneNode, data: unknown): string {
  if (requested) return requested.replace(/\[\]$/, "") || "[]";
  const payload = readPayload(template);
  if (payload?.kind === "repeat-template") return payload.arrayPath;
  const fromData = getDefaultArrayPath(data);
  if (fromData) return fromData;
  throw new Error("Click a list in your content, like investors.");
}

function getDefaultArrayPath(data: unknown): string | null {
  return pickDefaultArrayPath(data);
}

function firstItem(data: unknown, arrayPath: string): unknown {
  const items = getArrayAtPath(data, arrayPath);
  if (!items) throw new Error(`No list found at ${arrayPath || "root"}.`);
  return items[0] ?? {};
}

export async function previewRepeat(arrayPath: string): Promise<SelectionInfo> {
  const node = resolveTemplate(resolveRepeatTarget(requireSingle()));
  if (!REPEATABLE.has(node.type)) {
    throw new Error("Select a row or frame to match layers.");
  }
  const data = requireData();
  const path = resolveArrayPath(arrayPath, node, data);
  const item = firstItem(data, path);
  const bindings = autoMap(node, item, { rename: true, arrayPath: path });
  if (bindings.length === 0) {
    throw new Error("This row doesn’t have any text layers to fill.");
  }
  writePayload(node, { v: 1, kind: "repeat-template", arrayPath: path, bindings });
  await populateRow(node, item, bindings);
  return inspectSelection();
}

export async function generateRows(arrayPath?: string): Promise<{
  selection: SelectionInfo;
  created: number;
  updated: number;
  removed: number;
}> {
  const node = resolveTemplate(resolveRepeatTarget(requireSingle()));
  if (!REPEATABLE.has(node.type) && node.type !== "COMPONENT") {
    throw new Error("Select the row you want to fill.");
  }
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    throw new Error("Select a frame or instance — not the main component.");
  }
  const data = requireData();
  const path = resolveArrayPath(arrayPath, node, data);
  const records = getArrayAtPath(data, path);
  if (!records) throw new Error(`No list found at ${path || "root"}.`);
  if (records.length === 0) throw new Error("That list is empty.");
  const fill = shouldFillExisting(node);
  const target = fill ? siblingRows(node)[0] ?? node : node;
  const item = records[0];
  const maps = autoMap(target, item, { rename: true, arrayPath: path });
  if (maps.length === 0) {
    throw new Error("This row doesn’t have any text layers to fill.");
  }
  const result = fill
    ? await fillExistingRows(target, data, path, maps)
    : await syncRepeat(target, data, path, maps);
  return { selection: inspectSelection(), ...result };
}

export async function fillExistingRows(
  template: SceneNode,
  data: unknown,
  arrayPath: string,
  bindings: LayerBinding[],
): Promise<{ created: number; updated: number; removed: number }> {
  const items = getArrayAtPath(data, arrayPath);
  if (!items) throw new Error(`No list found at ${arrayPath || "root"}.`);
  const rows = siblingRows(template);
  const origin = rows[0] ?? template;
  let updated = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const item = items[i];
    if (item === undefined) break;
    const row = rows[i];
    const maps = i === 0 ? bindings : autoMap(row, item, { rename: true, arrayPath });
    if (maps.length === 0) continue;
    if (i === 0) {
      writePayload(row, { v: 1, kind: "repeat-template", arrayPath, bindings: maps, fillExisting: true });
    } else {
      writePayload(row, { v: 1, kind: "repeat-instance", templateId: origin.id, index: i });
    }
    await populateRow(row, item, maps);
    updated += 1;
  }

  figma.viewport.scrollAndZoomIntoView(rows);
  return { created: 0, updated, removed: 0 };
}

export async function syncRepeat(
  template: SceneNode,
  data: unknown,
  arrayPath: string,
  bindings: LayerBinding[],
): Promise<{ created: number; updated: number; removed: number }> {
  const items = getArrayAtPath(data, arrayPath);
  if (!items) throw new Error(`No list found at ${arrayPath || "root"}.`);
  const parent = parentOf(template);

  writePayload(template, { v: 1, kind: "repeat-template", arrayPath, bindings });

  const existing = findInstances(parent, template.id);
  existing.sort((a, b) => parent.children.indexOf(a) - parent.children.indexOf(b));

  let created = 0;
  let removed = 0;
  let updated = 0;

  try {
    await populateRow(template, items[0] ?? {}, bindings);
    updated += 1;

    const needed = Math.max(items.length - 1, 0);
    for (let i = 0; i < needed; i += 1) {
      let row = existing[i];
      if (!row) {
        const insertAt = parent.children.indexOf(template) + 1 + i;
        row = duplicateRow(template, parent, insertAt);
        created += 1;
      }
      writePayload(row, { v: 1, kind: "repeat-instance", templateId: template.id, index: i + 1 });
      await populateRow(row, items[i + 1], bindings);
      updated += 1;
    }

    for (let i = needed; i < existing.length; i += 1) {
      existing[i].remove();
      removed += 1;
    }

    spaceGeneratedRows(template, parent);
    figma.viewport.scrollAndZoomIntoView(generatedRows(template, parent));
  } finally {
    for (const row of generatedRows(template, parent)) row.visible = true;
  }

  return { created, updated, removed };
}

export async function populateSelection(): Promise<SelectionInfo> {
  const data = requireData();
  const node = requireSingle();
  const payload = readPayload(node);
  if (node.type === "TEXT" && payload?.kind === "field") {
    await populateField(node, data, payload.path);
    return inspectSelection();
  }
  if (payload?.kind === "repeat-template") {
    if (payload.fillExisting || shouldFillExisting(node)) {
      await fillExistingRows(node, data, payload.arrayPath, payload.bindings);
    } else {
      await syncRepeat(node, data, payload.arrayPath, payload.bindings);
    }
    return inspectSelection();
  }
  if (node.type === "TEXT") {
    throw new Error("Click a field in the list to fill this text layer.");
  }
  throw new Error("Match layers first, then generate.");
}

export function clearSelection(): SelectionInfo {
  const nodes = figma.currentPage.selection;
  if (nodes.length === 0) throw new Error("Select a mapped layer to clear.");
  for (const node of nodes) {
    const payload = readPayload(node);
    if (payload?.kind === "repeat-template" && node.parent && "children" in node.parent) {
      for (const child of [...node.parent.children]) {
        const childPayload = readPayload(child);
        if (childPayload?.kind === "repeat-instance" && childPayload.templateId === node.id) {
          clearPayload(child);
        }
      }
    }
    clearPayload(node);
    walk(node, (child) => {
      if (child !== node) clearPayload(child);
    });
  }
  return inspectSelection();
}

export function inspectSelection(): SelectionInfo {
  const nodes = figma.currentPage.selection;
  if (nodes.length === 0) {
    return {
      empty: true,
      name: "",
      type: "",
      nodeType: "none",
      boundPath: null,
      isTemplate: false,
      isInstance: false,
      arrayPath: null,
      textLayers: [],
      mappings: [],
      canRepeat: false,
      fillExisting: false,
      existingRowCount: 0,
    };
  }

  const selected = nodes[0];
  const node = resolveRepeatTarget(selected);
  const payload = readPayload(node);
  const data = readDocumentJson();
  const canRepeat = REPEATABLE.has(node.type) && collectTextNodes(node).length > 0;
  const textLayers = collectTextNodes(node).map((text) => ({
    name: displayLayerName(node, text),
    path: getLayerPath(node, text),
  }));

  let mappings: MappingPreview[] = [];
  let arrayPath: string | null = null;
  const template = payload?.kind === "repeat-instance" ? resolveTemplateSafe(node) : node;
  const templatePayload = template ? readPayload(template) : null;
  const mapRoot = template ?? node;

  if (canRepeat && data) {
    const storedPath = templatePayload?.kind === "repeat-template" ? templatePayload.arrayPath : null;
    const storedOk = Boolean(storedPath && getArrayAtPath(data, storedPath));
    const guessed = storedOk ? storedPath : getDefaultArrayPath(data);
    if (guessed) {
      const item = getArrayAtPath(data, guessed)?.[0] ?? {};
      mappings = mappingPreviews(mapRoot, item, autoMap(mapRoot, item, { rename: false }));
      arrayPath = guessed;
    } else if (typeof data === "object" && !Array.isArray(data)) {
      mappings = mappingPreviews(mapRoot, data, autoMap(mapRoot, data, { rename: false }));
    }
  }

  const label = node !== selected ? `${selected.name} / ${node.name}` : node.name;
  const selectedPayload = readPayload(selected);
  const boundPath =
    selectedPayload?.kind === "field"
      ? selectedPayload.path
      : payload?.kind === "field"
        ? payload.path
        : null;

  return {
    empty: false,
    name: label,
    type: node.type,
    nodeType: selected.type === "TEXT" ? "text" : canRepeat ? "repeatable" : "other",
    boundPath,
    isTemplate: templatePayload?.kind === "repeat-template" || payload?.kind === "repeat-template",
    isInstance: payload?.kind === "repeat-instance",
    arrayPath,
    textLayers,
    mappings,
    canRepeat,
    fillExisting: canRepeat && shouldFillExisting(mapRoot),
    existingRowCount: canRepeat ? siblingRows(mapRoot).length : 0,
  };
}

function resolveTemplateSafe(node: SceneNode): SceneNode | null {
  return resolveTemplate(node);
}
