import type { PluginToUI, SampleId, SelectionInfo, UIToPlugin } from "../shared/messages";
import {
  buildTree,
  findObjectArrays,
  parseJsonText,
  pickDefaultArrayPath,
  summarizeJson,
  type JsonTreeNode,
} from "../shared/json";
import { SAMPLE_OPTIONS, getSampleText } from "../shared/samples";
import { paintIcons, type LucideName } from "./icons";

const editor = $<HTMLTextAreaElement>("editor");
const errorEl = $("error");
const summaryEl = $("summary");
const treeEl = $("tree");
const selEl = $("sel");
const mapsEl = $("maps");
const statusEl = $("status");
const sampleEl = $<HTMLSelectElement>("sample");
const autoMapBtn = $<HTMLButtonElement>("auto-map");
const generateBtn = $<HTMLButtonElement>("generate");
const clearBtn = $<HTMLButtonElement>("clear");

let data: unknown | null = null;
let selection: SelectionInfo | null = null;
let selectedPath: string | null = null;
const collapsed = new Set<string>();
let debounce: number | null = null;
let busy = false;
let statusTimer: number | null = null;

function $<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

function post(message: UIToPlugin): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

function setStatus(text: string, kind: "ok" | "err" | "" = ""): void {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`.trim();
  if (statusTimer) window.clearTimeout(statusTimer);
  if (kind === "ok" && text) {
    statusTimer = window.setTimeout(() => {
      statusEl.textContent = "";
      statusEl.className = "status";
    }, 2400);
  }
}

function currentArrayPath(): string | null {
  if (selectedPath && (selectedPath.endsWith("[]") || selectedPath === "[]")) {
    return selectedPath;
  }
  if (selection?.arrayPath) return selection.arrayPath;
  if (data) return pickDefaultArrayPath(data);
  return null;
}

function setEmpty(el: HTMLElement, icon: LucideName, title: string | null, hint: string | null): void {
  const heading = title ? `<strong>${escapeHtml(title)}</strong>` : "";
  const body = hint ? `<p>${escapeHtml(hint)}</p>` : "";
  el.innerHTML = `
    <div class="empty">
      <i data-lucide="${icon}"></i>
      <div class="empty-copy">${heading}${body}</div>
    </div>
  `;
  paintIcons(el);
}

function refreshView(): void {
  if (selection) renderSelection(selection);
  else {
    renderTree();
    updateActions();
  }
}

function applyJson(text: string, persist: boolean): void {
  if (editor.value !== text) editor.value = text;
  if (!text.trim()) {
    data = null;
    selectedPath = null;
    editor.classList.remove("invalid");
    errorEl.hidden = true;
    errorEl.textContent = "";
    summaryEl.textContent = "";
    summaryEl.classList.remove("hint");
    if (persist) post({ type: "set-json", json: "" });
    refreshView();
    return;
  }
  const parsed = parseJsonText(text);
  if (!parsed.ok) {
    data = null;
    editor.classList.add("invalid");
    errorEl.hidden = false;
    errorEl.textContent = parsed.error;
    summaryEl.textContent = "";
    summaryEl.classList.remove("hint");
    refreshView();
    return;
  }
  data = parsed.data;
  editor.classList.remove("invalid");
  errorEl.hidden = true;
  errorEl.textContent = "";
  summaryEl.textContent = summarizeJson(parsed.data);
  summaryEl.classList.remove("hint");
  if (persist) post({ type: "set-json", json: text });
  refreshView();
}

function renderTree(): void {
  treeEl.innerHTML = "";
  if (data == null) {
    if (editor.classList.contains("invalid")) {
      setEmpty(treeEl, "circle-alert", "Can’t preview", "Fix the JSON above.");
    } else {
      setEmpty(treeEl, "braces", "No content yet", "Paste JSON or pick a sample.");
    }
    return;
  }
  const root = buildTree(data);
  const nodes = root.kind === "object" ? root.children : [root];
  for (const node of nodes) treeEl.appendChild(renderNode(node, 0));
}

function isCollapsed(path: string, node: JsonTreeNode): boolean {
  if (collapsed.has(path)) return true;
  if (collapsed.has(`!${path}`)) return false;
  return path.endsWith("#records") || /\[\d+\]$/.test(path) || node.key.startsWith("+");
}

function toggle(path: string, node: JsonTreeNode): void {
  if (isCollapsed(path, node)) {
    collapsed.add(`!${path}`);
    collapsed.delete(path);
  } else {
    collapsed.add(path);
    collapsed.delete(`!${path}`);
  }
  renderTree();
}

function renderNode(node: JsonTreeNode, depth: number): HTMLElement {
  const wrap = document.createElement("div");
  const hasKids = node.children.length > 0 || (node.fields && node.fields.length > 0);
  const closed = hasKids && isCollapsed(node.path, node);
  const row = document.createElement("div");
  row.className = "row";
  row.style.paddingLeft = `${6 + depth * 10}px`;
  row.setAttribute("role", "treeitem");
  if (node.path === selectedPath) row.classList.add("selected");
  if (selection?.boundPath && concretize(selection.boundPath) === concretize(node.path)) {
    row.classList.add("bound");
  }

  const chev = document.createElement("span");
  chev.className = `chev${hasKids && !closed ? " open" : ""}`;
  chev.textContent = hasKids ? "▶" : "";
  row.appendChild(chev);

  const key = document.createElement("span");
  key.className = `key${node.kind === "array" ? " array" : ""}`;
  key.textContent = node.key;
  row.appendChild(key);

  if (node.kind === "array" && node.count != null) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = String(node.count);
    row.appendChild(pill);
  } else if (node.preview && node.kind === "value") {
    const preview = document.createElement("span");
    preview.className = "preview";
    preview.textContent = node.preview;
    row.appendChild(preview);
  }

  row.addEventListener("click", (event) => {
    event.stopPropagation();
    if ((event.target as HTMLElement).classList.contains("chev") && hasKids) {
      toggle(node.path, node);
      return;
    }
    selectedPath = node.path;
    onTreePick(node);
    renderTree();
  });

  wrap.appendChild(row);

  if (!closed && node.fields) {
    for (const field of node.fields) {
      wrap.appendChild(renderField(field, depth + 1, node.path));
    }
  }

  if (!closed && node.kind === "array" && node.children.length > 0) {
    const records: JsonTreeNode = {
      path: `${node.path}#records`,
      key: "items",
      kind: "object",
      valueType: "object",
      preview: "",
      children: node.children,
    };
    wrap.appendChild(renderNode(records, depth + 1));
  } else if (!closed) {
    for (const child of node.children) wrap.appendChild(renderNode(child, depth + 1));
  }

  return wrap;
}

function renderField(
  field: { key: string; path: string; preview: string },
  depth: number,
  arrayPath: string,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";
  row.style.paddingLeft = `${6 + depth * 10}px`;
  if (field.path === selectedPath) row.classList.add("selected");
  if (selection?.boundPath && concretize(selection.boundPath) === concretize(field.path)) {
    row.classList.add("bound");
  }
  row.innerHTML = `<span class="chev"></span><span class="key">${escapeHtml(field.key)}</span><span class="preview">${escapeHtml(field.preview)}</span>`;
  row.addEventListener("click", (event) => {
    event.stopPropagation();
    selectedPath = field.path;
    if (selection?.nodeType === "text") post({ type: "bind-field", path: field.path });
    else selectedPath = arrayPath;
    renderTree();
  });
  return row;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

function concretize(path: string): string {
  return path.replace(/\[\]/g, "[0]");
}

function onTreePick(node: JsonTreeNode): void {
  if (node.kind === "value" && selection?.nodeType === "text") {
    post({ type: "bind-field", path: node.path });
    return;
  }
  if (node.kind === "array" && selection?.canRepeat) {
    post({ type: "preview-repeat", arrayPath: node.path });
  }
}

function fieldLabel(path: string): string {
  return path.replace(/\[\]/g, "").split(".").filter(Boolean).pop() ?? path;
}

function renderSelection(next: SelectionInfo, options: { mapped?: boolean } = {}): void {
  selection = next;
  mapsEl.classList.remove("just-mapped");
  mapsEl.innerHTML = "";

  if (next.empty) {
    selEl.innerHTML = "";
    if (!data) setEmpty(mapsEl, "mouse-pointer-2", null, "Add content, then select a row.");
    else setEmpty(mapsEl, "mouse-pointer-2", null, "Select a row to fill.");
  } else if (next.nodeType === "text") {
    selEl.innerHTML = `Selected <strong>${escapeHtml(next.name)}</strong>`;
    if (next.boundPath) {
      selEl.innerHTML = `<strong>${escapeHtml(next.name)}</strong> · ${escapeHtml(fieldLabel(next.boundPath))}`;
      setEmpty(mapsEl, "rows-3", null, "Select the parent row to fill a list.");
    } else if (!data) {
      setEmpty(mapsEl, "type", null, "Add content, then click a field.");
    } else {
      setEmpty(mapsEl, "type", null, "Click a field to fill this layer.");
    }
  } else if (next.isInstance) {
    selEl.innerHTML = "Generated row";
    setEmpty(mapsEl, "copy", null, "Select the original row to update all.");
  } else if (next.canRepeat) {
    const count = next.mappings.length || next.textLayers.length;
    if (next.mappings.length > 0) {
      selEl.innerHTML = `Identified mappings · <strong>${count}</strong>`;
    } else if (!data) {
      selEl.innerHTML = "";
    } else {
      selEl.innerHTML = "Ready to map";
      setEmpty(mapsEl, "wand-sparkles", null, "Auto-map matches layers to fields.");
    }
  } else {
    selEl.innerHTML = `Selected <strong>${escapeHtml(next.name)}</strong>`;
    setEmpty(mapsEl, "frame", null, "Select a text layer or a row.");
  }

  if (next.canRepeat && next.mappings.length > 0) {
    const rows = next.mappings
      .map((mapping) => {
        const field = mapping.field ? escapeHtml(mapping.field) : "Not matched";
        const muted = mapping.field ? "" : " muted";
        return `<tr><td>${escapeHtml(mapping.layerName)}</td><td><span class="field${muted}">${field}</span></td></tr>`;
      })
      .join("");
    mapsEl.innerHTML = `
      <table class="map-table">
        <thead><tr><th>Layer</th><th>Field</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    if (options.mapped) {
      void mapsEl.offsetWidth;
      mapsEl.classList.add("just-mapped");
    }
  }

  updateActions();
  renderTree();
}

function setBusy(next: boolean, label = "Generating…"): void {
  busy = next;
  generateBtn.classList.toggle("loading", next);
  if (next) {
    generateBtn.disabled = true;
    generateBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${label}`;
    autoMapBtn.disabled = true;
    clearBtn.disabled = true;
    clearBtn.hidden = !editor.value.trim();
    return;
  }
  updateActions();
}

function updateActions(): void {
  if (busy) return;
  const arrayPath = currentArrayPath();
  const mapped = selection?.mappings.some((item) => item.field) ?? false;
  autoMapBtn.disabled = !(selection?.canRepeat && data);
  generateBtn.disabled = !(selection?.canRepeat && data && arrayPath && (mapped || selection.textLayers.length > 0));
  const hasContent = Boolean(editor.value.trim());
  clearBtn.hidden = !hasContent;
  clearBtn.disabled = !hasContent;

  const count = arrayCount(arrayPath);
  if (selection?.isTemplate && count) generateBtn.textContent = `Update ${count} rows`;
  else generateBtn.textContent = count ? `Generate ${count} rows` : "Generate rows";
}

function arrayCount(path: string | null): number {
  if (!data || !path) return 0;
  const info = findObjectArrays(data).find((item) => item.path === path.replace(/\[\]$/, "") || item.path === path);
  return info?.count ?? 0;
}

function loadSample(id: SampleId): void {
  applyJson(getSampleText(id, "normal"), true);
  const label = SAMPLE_OPTIONS.find((option) => option.id === id)?.label ?? id;
  setStatus(`Loaded ${label}`, "ok");
}

for (const option of SAMPLE_OPTIONS) {
  const node = document.createElement("option");
  node.value = option.id;
  node.textContent = option.label;
  sampleEl.appendChild(node);
}

sampleEl.addEventListener("change", () => {
  if (!sampleEl.value) return;
  loadSample(sampleEl.value as SampleId);
});

editor.addEventListener("input", () => {
  sampleEl.value = "";
  updateActions();
  if (debounce) window.clearTimeout(debounce);
  debounce = window.setTimeout(() => applyJson(editor.value, true), 220);
});

autoMapBtn.addEventListener("click", () => {
  const path = currentArrayPath();
  if (path) post({ type: "preview-repeat", arrayPath: path });
});

generateBtn.addEventListener("click", () => {
  if (busy) return;
  setBusy(true, "Generating…");
  post({ type: "generate", arrayPath: currentArrayPath() ?? undefined });
});

clearBtn.addEventListener("click", () => {
  sampleEl.value = "";
  applyJson("", true);
  setStatus("Content cleared");
});

window.onmessage = (event: MessageEvent<{ pluginMessage: PluginToUI }>) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;
  switch (msg.type) {
    case "init":
      if (msg.json) applyJson(msg.json, false);
      renderSelection(msg.selection);
      break;
    case "selection":
      renderSelection(msg.selection);
      break;
    case "mapped":
      renderSelection(msg.selection, { mapped: true });
      setStatus("Layers matched", "ok");
      break;
    case "busy":
      setBusy(true, "Generating…");
      break;
    case "done":
      setBusy(false);
      renderSelection(msg.selection);
      setStatus(msg.message, "ok");
      break;
    case "error":
      setBusy(false);
      setStatus(msg.message, "err");
      break;
    default:
      break;
  }
};

paintIcons(document.body);
post({ type: "ready" });
