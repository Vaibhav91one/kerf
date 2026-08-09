# Kerf Light Library Direction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new light-only Kerf visual-direction page using preset Khagwal 3D Community assets while preserving the existing dark sample, wireframes, FigJam board, and every other Figma file.

**Architecture:** Work only in Figma design file `VdPEaCxSvkLqEKibE5qpRE`. Create `01 — Light Platform Direction` as a new page with one 1,600 px presentation board and a separate imported-asset tray; download the approved Amber/perspective Khagwal renders from the publisher's library, upload them to that page, and clone those source nodes wherever illustrations are needed. Build and validate one section at a time, then compare the protected page structures by their existing node IDs.

**Tech Stack:** Figma Plugin API through `use_figma`, Figma asset upload API, Figma screenshots/metadata, SUSE and SUSE Mono, Phosphor regular SVG icons, Simple Icons Claude glyph, Khagwal 3D Amber preset WebP assets, shell `curl`, ImageMagick identification tools.

---

### Task 1: Capture protected-page baselines

**Files:**
- Reference: `docs/superpowers/specs/2026-08-09-kerf-light-library-sample-update-design.md`
- Reference: `BUILD_LOG.md`
- Reference: `CLAUDE.md`

- [ ] **Step 1: Record the current design-file page inventory**

Call `get_metadata` without a node ID for file `VdPEaCxSvkLqEKibE5qpRE` and confirm these protected pages exist:

```text
Wireframes — low-fi                 node 0:1
00 — Visual Direction Sample        node 26:2
```

- [ ] **Step 2: Audit protected node counts**

Use a read-only `use_figma` call and return:

```js
const wire = await figma.getNodeByIdAsync("0:1");
const darkPage = await figma.getNodeByIdAsync("26:2");
const darkRoot = await figma.getNodeByIdAsync("26:3");
return {
  createdNodeIds: [],
  wireTopLevel: wire.children.length,
  wireFrames: wire.children.filter(n => n.type === "FRAME").length,
  darkTopLevel: darkPage.children.length,
  darkSections: darkRoot.children.filter(n => n.type === "FRAME").length
};
```

Expected: `wireTopLevel: 20`, `wireFrames: 9`, `darkTopLevel: 1`, `darkSections: 7`.

- [ ] **Step 3: Capture protected screenshots**

Call `get_screenshot` for nodes `0:1` and `26:3`. These are comparison references only; do not mutate either node.

### Task 2: Stage approved Khagwal Community assets

**Files:**
- Temporary only: `/private/tmp/kerf-khagwal-amber/*.webp`

- [ ] **Step 1: Create an isolated temporary asset directory**

Run:

```bash
mkdir -p /private/tmp/kerf-khagwal-amber
```

- [ ] **Step 2: Download the exact approved preset renders**

Run:

```bash
for asset in badge trophy shield lock pencil gear dart_board clock bell; do
  curl -fLsS \
    "https://3d.khagwal.com/explorer/bucket/preview/amber/${asset}_perspective.webp" \
    -o "/private/tmp/kerf-khagwal-amber/${asset}.webp"
done
```

Expected: nine non-empty WebP files from the Khagwal 3D Amber/perspective family.

- [ ] **Step 3: Verify format, dimensions, and transparency-capable source**

Run:

```bash
magick identify /private/tmp/kerf-khagwal-amber/*.webp
```

Expected: every file identifies as WebP and shares the library's 1,080 × 1,080 preview canvas.

- [ ] **Step 4: Visually inspect the exact asset set**

Create a temporary contact sheet with ImageMagick and inspect it. Reject any failed download or asset from a different theme before uploading.

### Task 3: Create the isolated light-direction page

**Files:**
- Modify externally: Figma design file `VdPEaCxSvkLqEKibE5qpRE`

- [ ] **Step 1: Load Figma write guidance**

Read `skill://figma/figma-use/SKILL.md` and `skill://figma/figma-generate-design/SKILL.md` completely before the first `use_figma` call.

- [ ] **Step 2: Reconfirm available design-system libraries**

Call `get_libraries` and `search_design_system` for light buttons, cards, navigation, fields, and tables. Reuse a library asset only if its token/API model fits the Kerf direction; otherwise build a direction-sample frame rather than a production component.

- [ ] **Step 3: Create the new page and wrapper only**

Use one atomic `use_figma` call:

```js
const existing = figma.root.children.find(p => p.name === "01 — Light Platform Direction");
if (existing) throw new Error("Light direction page already exists");
const page = figma.createPage();
page.name = "01 — Light Platform Direction";
await figma.setCurrentPageAsync(page);
const root = figma.createFrame();
root.name = "Kerf / Light Platform Direction v1";
root.resize(1600, 7600);
root.fills = [{ type: "SOLID", color: { r: 247/255, g: 248/255, b: 244/255 } }];
root.clipsContent = false;
page.appendChild(root);
return { createdNodeIds: [page.id, root.id], pageId: page.id, rootId: root.id };
```

Record the returned IDs for every later call.

- [ ] **Step 4: Confirm page isolation**

Re-run the protected counts from Task 1. Expected values remain `20`, `9`, `1`, and `7`.

### Task 4: Upload and organize the library source tray

**Files:**
- Read: `/private/tmp/kerf-khagwal-amber/*.webp`
- Modify externally: Figma page `01 — Light Platform Direction`

- [ ] **Step 1: Request nine Figma asset upload URLs**

Call `upload_assets` with `count: 9` for file `VdPEaCxSvkLqEKibE5qpRE` after the new page is current.

- [ ] **Step 2: POST each source file to its single-use URL**

Use `curl --data-binary` and `Content-Type: image/webp` exactly once per returned upload URL. Map URLs in this order:

```text
badge, trophy, shield, lock, pencil, gear, dart_board, clock, bell
```

- [ ] **Step 3: Move uploaded nodes into a named source tray**

Use `use_figma` to create a top-level frame named `Khagwal 3D / Amber / Source Assets` at `x: 1680`, `y: 0`. Move each uploaded image frame into the tray, size it to 180 × 180, and rename it using this pattern:

```text
Khagwal 3D / Amber / <asset> / perspective
```

- [ ] **Step 4: Add provenance text**

Add `Preset assets · Khagwal 3D · Amber / perspective · CC0` to the tray and later to the illustration-library specimen. Do not claim the assets as custom Kerf artwork.

### Task 5: Build the light board skeleton and global foundations

**Files:**
- Modify externally: Figma page `01 — Light Platform Direction`

- [ ] **Step 1: Create seven direct section frames**

Create these direct children of the root with `x: 64`, `width: 1472`, 48 px gaps, white fill, `#DDE4DA` border, 24 px radius, and a restrained shadow:

```text
01 / Brand premise
02 / Foundations
03 / Icon + illustration language
04 / Component specimens
05 / Home direction
06 / Live direction
07 / Honest empty state
```

- [ ] **Step 2: Load the exact fonts before text writes**

Load SUSE Regular/Medium/SemiBold/Bold and SUSE Mono Regular/SemiBold. Use `#162019` for primary text and `#667269` for supporting text.

- [ ] **Step 3: Apply the semantic palette**

Use only these light-system roles for application surfaces:

```js
const C = {
  canvas: "#F7F8F4", surface: "#FFFFFF", soft: "#EFF3EC", border: "#DDE4DA",
  ink: "#162019", muted: "#667269", green: "#276C3D", lime: "#A8E85C",
  cyan: "#187E87", coral: "#D65A4A", claude: "#D97757"
};
```

- [ ] **Step 4: Validate the empty skeleton**

Take a root screenshot and verify seven white sections on the warm canvas with no dark surface fills.

### Task 6: Build Brand and Foundations sections

**Files:**
- Modify externally: Figma sections `01 / Brand premise` and `02 / Foundations`

- [ ] **Step 1: Build the premium light hero**

Create the split hero with the approved value proposition, accessible action chips, rework curve, and an illustration stage. Clone `dart_board`, `pencil`, and `badge` from the source tray; do not draw substitute artwork.

- [ ] **Step 2: Build palette, typography, depth, and shape specimens**

Show the eleven approved colors, SUSE/SUSE Mono hierarchy, white/soft surface levels, spacing from 4–32 px, and radii 8/12/16/24.

- [ ] **Step 3: Add library context specimens**

Clone `gear` and `shield` into small tonal stages labelled `SYSTEM OPERATION` and `PRIVACY + TRUST`.

- [ ] **Step 4: Screenshot and fix both sections**

Validate contrast, asset cropping, text fit, and direct-child bounds before proceeding.

### Task 7: Build icon, tier, badge, and illustration language

**Files:**
- Modify externally: Figma section `03 / Icon + illustration language`

- [ ] **Step 1: Rebuild the navigation and status icon specimen**

Use Phosphor regular vectors at 24 px. Default icons use `#667269`; active icons use `#276C3D` on `#EFF3EC`. Keep the official Claude silhouette on terracotta.

- [ ] **Step 2: Rebuild the five tier crests**

Keep the shared crest geometry and increasing facet complexity. Adapt metal fills and outlines for white surfaces without changing Bronze/Silver/Gold/Platinum/Diamond semantics.

- [ ] **Step 3: Rebuild the six product badges**

Preserve the exact Clean Run, Diamond Session, Diamond ×5, Steady Hand, Streak 3, and Streak 7 meanings. Labels must state the earning condition and `DISPLAY ONLY`.

- [ ] **Step 4: Add the preset illustration-library specimen**

Clone and label `badge`, `trophy`, `shield`, `pencil`, `gear`, `dart_board`, and `clock`. Add the provenance line and keep all clones in the Amber/perspective family.

- [ ] **Step 5: Screenshot and fix the section**

Verify interface icons do not resemble 3D feature illustrations and all seven library assets are visibly consistent.

### Task 8: Build light component specimens

**Files:**
- Modify externally: Figma section `04 / Component specimens`

- [ ] **Step 1: Build actions and inputs**

Primary button: `#276C3D` with white text. Secondary controls: white with `#DDE4DA` border. Destructive controls: coral outline and explicit destructive verb. Focus indication uses lime plus a dark accessible label.

- [ ] **Step 2: Build metrics, sidebar-07, data rows, and feedback**

Use white cards over soft surfaces, mono numerals, selected-row tinting, and restrained shadows. Preserve lower-is-better labels and Claude/cyan source identity.

- [ ] **Step 3: Screenshot and fix the section**

Check hierarchy, table scanning, active navigation, control contrast, and no dark fills.

### Task 9: Build the three high-fidelity light excerpts

**Files:**
- Modify externally: Figma sections `05 / Home direction`, `06 / Live direction`, and `07 / Honest empty state`

- [ ] **Step 1: Build Home**

Use a white sidebar, ivory content canvas, white metric cards, forest action button, rework curve, recent sessions, and league standing. Clone `trophy` or `badge` into the league-progress card.

- [ ] **Step 2: Validate Home**

Screenshot the section and fix text fit, chart contrast, sidebar consistency, and illustration cropping.

- [ ] **Step 3: Build Live**

Use white telemetry surfaces, cyan connected/live states, coral reversals, aggregate-only activity, anonymous percentile ghosts, and prominent privacy copy. Clone `clock` and `pencil` as restrained context assets.

- [ ] **Step 4: Validate Live**

Screenshot the section and confirm there are no names, avatars, transcript snippets, prompts, code, or file contents.

- [ ] **Step 5: Build the honest empty state**

Use a centered light hero, one forest primary action, the three-step connect/work/close flow, and the local-first trust note. Replace the old custom cut-path art with clones of `dart_board`, `pencil`, and optionally `shield`.

- [ ] **Step 6: Validate the empty state**

Screenshot the section and confirm the only large illustration content comes from the Khagwal source tray.

### Task 10: Run final visual, structural, and isolation audits

**Files:**
- Modify only if defects are found: Figma page `01 — Light Platform Direction`

- [ ] **Step 1: Run a recursive bounds and font audit**

Use read-only `use_figma` traversal. Expected: `missingFontCount: 0`, `overflowCount: 0`.

- [ ] **Step 2: Audit theme purity**

Traverse visible application/presentation frames on the new page and flag fills equal to the old dark values `#080A0B`, `#101416`, or `#151B1E`. Expected: zero dark surface frames; dark ink-colored icon/vector fills are allowed.

- [ ] **Step 3: Audit asset provenance**

Confirm the source tray contains exactly nine named Khagwal nodes and every large illustration instance is a clone from that tray. Confirm the provenance note exists.

- [ ] **Step 4: Re-run protected-page baselines**

Expected values remain:

```text
Wireframes — low-fi: 20 top-level nodes, 9 frames
00 — Visual Direction Sample: 1 top-level root, 7 section frames
```

- [ ] **Step 5: Capture final screenshots**

Capture each major section and the full light board. Fix any clipping, overlap, weak contrast, accidental dead space, inconsistent illustration scale, or unexplained dark surface.

- [ ] **Step 6: Commit the plan/checklist state if updated**

Run:

```bash
git status --short
git diff --check
```

Commit only plan/spec documentation changed by the implementation; do not stage unrelated existing workspace files.

### Task 11: Hand off the new light page

**Files:**
- Reference: `docs/superpowers/specs/2026-08-09-kerf-light-library-sample-update-design.md`
- Reference: `docs/superpowers/plans/2026-08-09-kerf-light-library-direction.md`

- [ ] **Step 1: Provide the node-specific Figma link**

Link directly to the new `01 — Light Platform Direction` page/root and explicitly state that the dark sample and wireframes remain available.

- [ ] **Step 2: Report the asset source and license**

Name Khagwal 3D, Amber/perspective, Figma Community, and CC0. Do not describe the library illustrations as custom-created Kerf artwork.

- [ ] **Step 3: Report validation evidence**

Include final page counts, protected node counts, missing-font count, overflow count, and theme-purity result.
