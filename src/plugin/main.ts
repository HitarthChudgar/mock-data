import type { PluginToUI, UIToPlugin } from "../shared/messages";
import { parseJsonText } from "../shared/json";
import {
  bindSelectedField,
  clearSelection,
  generateRows,
  inspectSelection,
  populateSelection,
  previewRepeat,
} from "./apply";
import { writeDocumentJsonText } from "./data";

figma.skipInvisibleInstanceChildren = false;

figma.showUI(__html__, {
  width: 300,
  height: 560,
  themeColors: true,
  title: "Payload",
});

function send(message: PluginToUI): void {
  figma.ui.postMessage(message);
}

function formatResult(created: number, updated: number, removed: number): string {
  if (created && !removed && created === updated - 1) return `Generated ${updated} rows`;
  if (!created && !removed && updated) return `Filled ${updated} ${updated === 1 ? "row" : "rows"}`;
  const parts: string[] = [];
  if (created) parts.push(`${created} added`);
  if (removed) parts.push(`${removed} removed`);
  if (updated) parts.push(`${updated} updated`);
  return parts.length > 0 ? parts.join(" · ") : "Already up to date";
}

figma.ui.onmessage = async (msg: UIToPlugin) => {
  try {
    switch (msg.type) {
      case "ready":
        writeDocumentJsonText("");
        send({
          type: "init",
          json: "",
          selection: inspectSelection(),
        });
        break;
      case "set-json": {
        if (!msg.json.trim()) {
          writeDocumentJsonText("");
          send({ type: "selection", selection: inspectSelection() });
          return;
        }
        const parsed = parseJsonText(msg.json);
        if (!parsed.ok) {
          send({ type: "error", message: parsed.error });
          return;
        }
        writeDocumentJsonText(msg.json);
        send({ type: "selection", selection: inspectSelection() });
        break;
      }
      case "bind-field": {
        const selection = await bindSelectedField(msg.path);
        const field = msg.path.replace(/\[\]/g, "").split(".").filter(Boolean).pop() ?? msg.path;
        send({ type: "done", message: `Filled with ${field}`, selection });
        break;
      }
      case "preview-repeat": {
        const selection = await previewRepeat(msg.arrayPath);
        send({ type: "mapped", selection, arrayPath: selection.arrayPath ?? msg.arrayPath });
        break;
      }
      case "generate": {
        send({ type: "busy", action: "generate" });
        const result = await generateRows(msg.arrayPath);
        const message = formatResult(result.created, result.updated, result.removed);
        figma.notify(message);
        send({ type: "done", message, ...result });
        break;
      }
      case "populate": {
        const selection = await populateSelection();
        send({ type: "done", message: "Layers filled", selection });
        break;
      }
      case "clear": {
        const selection = clearSelection();
        send({ type: "done", message: "Mappings cleared", selection });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    send({ type: "error", message });
  }
};

figma.on("selectionchange", () => {
  send({ type: "selection", selection: inspectSelection() });
});

figma.on("close", () => {
  writeDocumentJsonText("");
});
