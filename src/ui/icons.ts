import {
  Braces,
  ChevronDown,
  CircleAlert,
  Copy,
  createIcons,
  Frame,
  MousePointer2,
  Rows3,
  Type,
  WandSparkles,
} from "lucide";

const icons = {
  Braces,
  ChevronDown,
  CircleAlert,
  Copy,
  Frame,
  MousePointer2,
  Rows3,
  Type,
  WandSparkles,
};

export type LucideName =
  | "braces"
  | "chevron-down"
  | "circle-alert"
  | "copy"
  | "frame"
  | "mouse-pointer-2"
  | "rows-3"
  | "type"
  | "wand-sparkles";

export function paintIcons(root: HTMLElement): void {
  createIcons({
    icons,
    root,
    attrs: {
      class: "icon",
      width: "16",
      height: "16",
      "stroke-width": "2",
    },
  });
}
