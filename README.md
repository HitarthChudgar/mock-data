# Payload

A Figma plugin that populates designs from structured JSON. Paste data, bind text layers or a repeating row, then Generate when the JSON changes.

## Install

```bash
npm install
npm run build
```

In Figma: **Plugins → Development → Import plugin from manifest…** and choose `manifest.json`.

`npm run watch` rebuilds as you edit.

## Demo

1. Create one Auto Layout row with text layers named **Firm**, **Ownership**, and **Change**.
2. Open Payload and choose **Institutions**, or paste investor JSON.
3. Select the row. Payload auto-maps child layers to `investors[]`.
4. Click **Generate rows**.
5. Edit a value in the JSON (or paste an updated payload).
6. Click **Generate** again. Existing rows update; extras are added or removed.

Mappings are stored on the Figma nodes, so the file remembers them.

## Samples

Investor-relations fixtures, each with **Normal**, **Long**, and **Missing** modes:

- Institutions
- Companies
- Contacts
- Holdings
- Events
