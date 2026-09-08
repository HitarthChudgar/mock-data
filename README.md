# Payload

A Figma plugin that populates designs from structured JSON. Paste data or pick a sample, map text layers, then generate repeating rows. Generate again when the JSON changes.

Mappings are stored on the Figma nodes, so the file remembers them. The plugin does not use the network.

## Install

```bash
npm install
npm run build
```

In Figma: **Plugins → Development → Import plugin from manifest…** and choose `manifest.json`.

`npm run watch` rebuilds as you edit.

## Usage

1. Create one Auto Layout row or card with the text layers you want filled — or lay out the full set of rows yourself.
2. Open Payload and paste JSON, or choose a sample.
3. Select the row (or the list). **Auto-map** matches layers to fields in the first array it finds (left to right, top to bottom). Layer names are not required.
4. Review **Identified mappings** in the Layer / Field table.
5. Click **Generate rows** to duplicate from one prototype, or **Fill rows** if the list is already on the canvas.
6. Edit the JSON and run it again. Generated lists add or remove extras; filled lists only update the rows that are already there.

**Clear content** empties the pasted or sample JSON. It does not remove mappings on the canvas.
