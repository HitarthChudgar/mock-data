export type FixtureMode = "normal" | "long" | "missing";

export type SampleId =
  | "companies"
  | "institutions"
  | "contacts"
  | "holdings"
  | "events";

export type LayerBinding = {
  layerPath: string;
  field: string;
};

export type MappingPreview = {
  layerName: string;
  layerPath: string;
  field: string | null;
  preview: string;
};

export type SelectionInfo = {
  empty: boolean;
  name: string;
  type: string;
  nodeType: "none" | "text" | "repeatable" | "other";
  boundPath: string | null;
  isTemplate: boolean;
  isInstance: boolean;
  arrayPath: string | null;
  textLayers: { name: string; path: string }[];
  mappings: MappingPreview[];
  canRepeat: boolean;
  fillExisting: boolean;
  existingRowCount: number;
};

export type UIToPlugin =
  | { type: "ready" }
  | { type: "set-json"; json: string }
  | { type: "bind-field"; path: string }
  | { type: "preview-repeat"; arrayPath: string }
  | { type: "generate"; arrayPath?: string }
  | { type: "populate" }
  | { type: "clear" };

export type PluginToUI =
  | { type: "init"; json: string; selection: SelectionInfo }
  | { type: "selection"; selection: SelectionInfo }
  | { type: "mapped"; selection: SelectionInfo; arrayPath: string }
  | {
      type: "done";
      message: string;
      selection: SelectionInfo;
      created?: number;
      updated?: number;
      removed?: number;
    }
  | { type: "busy"; action: "generate" }
  | { type: "error"; message: string };
