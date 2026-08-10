# Kerf Assets Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `Assets — Kerf` Figma page containing 25 solid icon components, 13 illustrated avatar components, five compact product-illustration components, and light/dark usage proofs without changing the production screens.

**Architecture:** Create all source assets as editable local components on one new Figma page. Bind foreground, surface, outline, and semantic accents to the existing Kerf Material 3 variables; demonstrate sizes and theme behavior only through instances. Perform mutations in small Figma transactions, preserve returned node IDs in the existing state ledger, and validate every section visually and structurally before handoff.

**Tech Stack:** Figma Plugin API through the official Figma MCP, editable SVG/vector nodes, Figma local components and instances, existing Kerf semantic variable collection `VariableCollectionId:98:3`, shell screenshot retrieval, and `/tmp/design-system-state-kerf-m3-20260809.json` for resumable state.

---

## File and document map

- Reference: `docs/superpowers/specs/2026-08-10-kerf-assets-library-design.md`
- Reference: `docs/superpowers/specs/2026-08-09-kerf-material-3-platform-design.md`
- Modify: `/tmp/design-system-state-kerf-m3-20260809.json`
- Create in Figma file `VdPEaCxSvkLqEKibE5qpRE`: page `Assets — Kerf`
- Preserve in Figma: page `Material 3 — Platform` and source wireframe frames `16:4`, `16:150`, `16:264`, `18:2`, `18:114`, `18:218`, `19:2`, `19:143`, `19:274`

### Task 1: Preflight and preservation snapshot

- [ ] **Step 1: Load required Figma guidance**

Read `figma-use`, `figma-generate-library`, and `figma-generate-design` in full. Pass the exact loaded resource names to every `use_figma` call.

- [ ] **Step 2: Read the existing state ledger**

Run:

```bash
jq '{fileKey,page,sections,collections,modes,variables,components,screens,validation}' /tmp/design-system-state-kerf-m3-20260809.json
```

Expected: file key `VdPEaCxSvkLqEKibE5qpRE`, semantic collection `VariableCollectionId:98:3`, Light mode `98:1`, and Dark mode `98:2`.

- [ ] **Step 3: Capture immutable source and production snapshots**

Use one read-only `use_figma` transaction to return page names plus `{id,name,width,height,textCount,childCount}` for all nine source frames and all eighteen production screens recorded in the ledger. Store the returned snapshot under `assetsPreflight` in memory for the final comparison.

- [ ] **Step 4: Check for an existing asset page**

Search page names for exact match `Assets — Kerf`. If no page exists, continue. If one exists from an incomplete run, inspect its plugin-generated section names and resume only missing sections; never create a duplicate page.

### Task 2: Create the Assets page and documentation shell

- [ ] **Step 1: Create or reuse the page**

Use the following page and section contract:

```js
const pageName = "Assets — Kerf";
const sections = [
  { name: "00 — Cover & Usage", x: 0, y: 0, width: 1600, height: 760 },
  { name: "01 — Solid Icons", x: 0, y: 840, width: 1600, height: 1700 },
  { name: "02 — People Avatars", x: 0, y: 2620, width: 1600, height: 1500 },
  { name: "03 — Product Illustrations", x: 0, y: 4200, width: 1600, height: 1900 },
  { name: "04 — Light & Dark Proofs", x: 0, y: 6180, width: 1600, height: 1600 },
];
```

Create each section as a page-level frame. Bind frame canvases to `Color/Surface/Canvas`, use 64 px outer padding, and add a 48 px title plus short usage copy.

- [ ] **Step 2: Build the cover**

Add the title `Kerf visual assets`, subtitle `Solid icons, illustrated people, and compact product scenes`, counts `25 icons · 13 avatars · 5 illustrations`, and three rules: semantic color only, editable vectors only, instances outside this page.

- [ ] **Step 3: Validate the shell**

Return page ID, section IDs, dimensions, direct-child names, and direct-child overlap count. Expected: five named frames, zero overlaps, and no production-screen mutations.

### Task 3: Build 25 solid icon components

- [ ] **Step 1: Define the inventory and SVG construction rules**

Use this exact icon list:

```js
const iconNames = [
  "Home", "Live", "Season", "Insights", "Projects", "Skills", "People", "Account",
  "Terminal", "Trophy", "Badge", "Activity", "Timer", "Upload", "Git branch", "Folder", "Privacy",
  "Add", "Search", "Copy", "External link", "More", "Chevron right", "Check", "Close"
];
```

Each SVG must use a 24 × 24 view box, filled paths, rounded geometry, no strokes, and `fill="currentColor"` semantics translated to a Figma paint bound to `Color/OnSurface`.

- [ ] **Step 2: Create icon masters in three bounded batches**

Batch 1 creates the eight navigation icons, Batch 2 creates the nine product icons, and Batch 3 creates the eight action icons. For every asset:

```js
const componentName = `Kerf/Asset/Icon/${name}`;
const component = figma.createComponentFromNode(svgNode);
component.name = componentName;
component.description = "Filled 24 px Kerf interface icon. Use semantic color variables; do not recolor with raw hex values.";
component.resize(24, 24);
```

Place masters in a five-column grid with 220 × 156 specimen cells. Label each component by its slash-delimited name.

- [ ] **Step 3: Add size and semantic-color instances**

Create instance-only rows for 16, 20, 24, and 32 px sizes. Create a semantic row using `Color/OnSurface`, `Color/Primary`, `Color/Live`, `Color/Success`, and `Color/OnPrimaryContainer`. Do not duplicate masters for size or color.

- [ ] **Step 4: Audit icon quality**

Return master count, duplicate-name count, component dimensions, vector editability, and instance count. Capture a screenshot at full section width and a close screenshot of the 16 px row. Expected: 25 masters, zero duplicate names, and recognizable open negative spaces at 16 px.

### Task 4: Build 13 illustrated avatar components

- [ ] **Step 1: Define identities**

Use these exact names:

```js
const identities = [
  "Vaibhav", "Ada", "June", "Theo", "Mira", "Sol", "Rune",
  "Ari", "Noor", "Ishan", "Lea", "Kai", "Fallback"
];
```

The twelve people vary skin tone, hair silhouette, hair color, glasses, facial hair, clothing, and background while sharing one circular 80 × 80 construction. `Fallback` uses a filled head-and-shoulders silhouette.

- [ ] **Step 2: Create editable vector masters**

Construct every avatar from named layers `Background`, `Shoulders`, `Neck`, `Face`, `Hair`, `Eyes`, `Nose`, `Mouth`, and optional `Glasses` or `Facial hair`. Wrap each in a component named `Kerf/Asset/Avatar/<Identity>` and bind the outer outline to `Color/OutlineVariant`.

- [ ] **Step 3: Build size specimens**

Create instances at 24, 32, 40, 56, and 80 px. Add a separate usage strip showing four avatars with external live dots; do not place status dots inside masters.

- [ ] **Step 4: Audit avatar clarity and variety**

Return master count, required layer coverage, duplicate color-signature count, and specimen sizes. Capture the entire avatar section plus a 24 px close-up. Expected: 13 masters, 13 distinguishable silhouettes/background combinations, and no facial detail collapsing outside the circular crop.

### Task 5: Build five compact product illustrations

- [ ] **Step 1: Create the illustration scenes**

Build these editable SVG/vector components with no embedded text:

```js
const illustrationSpecs = [
  { name: "CLI Sync", ratio: "9:5", meaning: "Local terminal data syncing through a privacy-safe outbound signal" },
  { name: "Empty Season", ratio: "7:4", meaning: "An empty ranking card with a first-step cue" },
  { name: "Live Activity", ratio: "7:4", meaning: "Three participant signals converging on one live pulse" },
  { name: "Insights", ratio: "7:4", meaning: "Rework-ratio bars moving toward a lower value" },
  { name: "Publish Project", ratio: "7:4", meaning: "Terminal output moving into a public project card" }
];
```

Use `Color/OnSurface`, `Color/Surface/Container`, `Color/PrimaryContainer`, and one contextual accent (`Color/Live`, `Color/Success`, or `Color/Primary`). Use no more than four colors in a scene.

- [ ] **Step 2: Convert scenes into documented components**

Name each component `Kerf/Asset/Illustration/<Name>`. Add the meaning string as the description. Preserve each intrinsic ratio and place one master plus 120 px, 200 px, and 320 px instance examples.

- [ ] **Step 3: Audit illustration semantics**

Capture focused screenshots of all five masters and the 120 px row. Expected: the subject remains identifiable without labels, there is no embedded text, and no scene resembles a generic decorative blob.

### Task 6: Build light/dark proof cards and usage guidance

- [ ] **Step 1: Create two proof boards from shared instances**

Create `Proof / Light` and `Proof / Dark` frames, each 704 × 1320. Set the semantic collection mode explicitly to `98:1` and `98:2`. Each proof contains eight core icon instances, Vaibhav/Ada/June/Theo avatar instances, and all five illustration instances.

- [ ] **Step 2: Add do/don't guidance**

Add four short rules:

- Do use semantic color roles.
- Do place live dots outside avatar masters.
- Don't recolor identity skin or hair between themes.
- Don't use illustrations as functional controls.

- [ ] **Step 3: Verify shared components**

Return each proof's instance main-component IDs and explicit variable mode. Expected: both proofs reference the same 43 masters and differ only through semantic modes and contextual arrangement.

### Task 7: Final validation and state handoff

- [ ] **Step 1: Run structural validation**

Return the following exact summary:

```js
{
  pageName: "Assets — Kerf",
  sections: 5,
  iconMasters: 25,
  avatarMasters: 13,
  illustrationMasters: 5,
  duplicateComponentNames: 0,
  directChildOverlap: 0,
  clippedDescendants: 0,
  lightProofMode: "98:1",
  darkProofMode: "98:2"
}
```

- [ ] **Step 2: Compare preservation snapshots**

Re-read the nine source frames and eighteen production screens and compare IDs, names, dimensions, text counts, and child counts to `assetsPreflight`. Expected: zero differences.

- [ ] **Step 3: Perform visual validation**

Capture screenshots of the full Assets page, Solid Icons, People Avatars, Product Illustrations, and Light & Dark Proofs. Inspect for clipping, optical-weight inconsistency, avatar repetition, muddy dark-mode contrast, and illustration noise. Correct issues in the owning section and repeat its screenshot.

- [ ] **Step 4: Update the resumable ledger**

Add an `assets` object to `/tmp/design-system-state-kerf-m3-20260809.json` containing the page ID, five section IDs, all 43 component IDs grouped by family, proof IDs, and the validation result. Use `apply_patch`, then verify JSON with:

```bash
jq '{phase, assets: {page: .assets.page, sections: (.assets.sections | length), icons: (.assets.components.icons | length), avatars: (.assets.components.avatars | length), illustrations: (.assets.components.illustrations | length), validation: .assets.validation.status}}' /tmp/design-system-state-kerf-m3-20260809.json
```

Expected: five sections, 25 icons, 13 avatars, five illustrations, and validation `passed`.

- [ ] **Step 5: Handoff for asset review**

Return a node-specific Figma link to `Assets — Kerf`, summarize the counts, confirm production screens were untouched, and explicitly wait for asset-page approval before applying assets to screens.
