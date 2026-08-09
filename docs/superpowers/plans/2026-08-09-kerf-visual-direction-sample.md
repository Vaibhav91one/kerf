# Kerf Visual Direction Sample Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one isolated, reviewable Figma page that demonstrates Kerf's high-fidelity visual system, relevant iconography, and three representative screen excerpts.

**Architecture:** Use sequential `use_figma` calls against the existing Design file. Create a page and a small set of named top-level section frames first, then fill one section per call and validate each with Figma metadata and screenshots. The sample uses frames and editable SVG nodes; production variables, component sets, and Code Connect remain out of scope until the visual direction is approved.

**Tech Stack:** Figma Plugin API, SUSE, SUSE Mono, Phosphor regular SVGs, Simple Icons Claude SVG, custom Kerf SVG crests.

---

### Task 1: Create the isolated page skeleton

**Files:**
- Create in Figma Design file `VdPEaCxSvkLqEKibE5qpRE`: page `00 — Visual Direction Sample`
- Preserve in Figma: page `Wireframes — low-fi`

- [ ] **Step 1: Verify the target page does not already exist**

```js
return figma.root.children.map((page) => ({ id: page.id, name: page.name }));
```

Expected: only `Wireframes — low-fi` exists before creation.

- [ ] **Step 2: Create the page and presentation board**

```js
const page = figma.createPage();
page.name = '00 — Visual Direction Sample';
await figma.setCurrentPageAsync(page);
const board = figma.createFrame();
board.name = 'Kerf / Visual Direction v1';
board.resize(1600, 7600);
board.fills = [{ type: 'SOLID', color: { r: 0.031, g: 0.039, b: 0.043 } }];
return { createdNodeIds: [page.id, board.id] };
```

Expected: one new page containing one dark 1600px-wide board.

- [ ] **Step 3: Validate structure**

Call `get_metadata` on the new page and confirm the existing wireframe page still has nine frames.

### Task 2: Build brand and foundations sections

**Files:**
- Modify in Figma: `Kerf / Visual Direction v1`

- [ ] **Step 1: Load verified SUSE font styles**

```js
await Promise.all([
  figma.loadFontAsync({ family: 'SUSE', style: 'Regular' }),
  figma.loadFontAsync({ family: 'SUSE', style: 'SemiBold' }),
  figma.loadFontAsync({ family: 'SUSE', style: 'Bold' }),
  figma.loadFontAsync({ family: 'SUSE Mono', style: 'Regular' }),
  figma.loadFontAsync({ family: 'SUSE Mono', style: 'SemiBold' }),
]);
```

- [ ] **Step 2: Add hero, palette, typography, and surface specimens**

Use fixed-width section frames with explicit text widths and `textAutoResize = 'HEIGHT'`. Apply the
approved graphite, lime, cyan, coral, Claude, and tier colors.

- [ ] **Step 3: Screenshot the foundations section**

Expected: every swatch is labelled, hierarchy is readable, and the board does not rely on pure black.

### Task 3: Create the vector icon families

**Files:**
- Modify in Figma: section `03 / Icon language`

- [ ] **Step 1: Import interface SVGs**

Use `figma.createNodeFromSvg()` with the Phosphor 256-grid assets for Home, Live, Season, Insights,
Projects, Skills, People, Account, Terminal, Privacy, Chat, Copy, and external navigation.

- [ ] **Step 2: Import the Claude source mark**

Use the Simple Icons Claude path on its native 24×24 view box and label it `Source / Claude Code`.

- [ ] **Step 3: Create five tier crests**

Create Bronze, Silver, Gold, Platinum, and Diamond as a shared 48×48 crest language with progressive
internal rank geometry and explicit tier colors.

- [ ] **Step 4: Create six achievement icons**

Map icons to `clean-run`, `diamond-session`, `diamond-x5`, `steady-hand`, `streak-3`, and `streak-7`.
Earned and locked examples must remain distinguishable without relying on color alone.

- [ ] **Step 5: Screenshot and compare optical sizes**

Expected: no icon looks visually heavier, smaller, or misaligned relative to the others.

### Task 4: Build component specimens

**Files:**
- Modify in Figma: section `04 / Component specimens`

- [ ] **Step 1: Build the sidebar specimen**

Include the Kerf mark, all existing navigation groups, selected state, Claude connection status, and
account footer.

- [ ] **Step 2: Build data and live specimens**

Create a metric card, tier-progress card, live-session tile, histogram treatment, standings row,
badge tile, privacy callout, command block, chat message, and empty-state panel.

- [ ] **Step 3: Add state annotations**

Show default, hover, focus-visible, pressed, live, locked, disconnected, and loading treatments.

- [ ] **Step 4: Screenshot the section**

Expected: components demonstrate one consistent surface, radius, border, icon, and typography system.

### Task 5: Compose representative screen excerpts

**Files:**
- Modify in Figma: sections `05 / Home`, `06 / Live`, and `07 / Honest empty state`

- [ ] **Step 1: Compose Home excerpt**

Use the real season logic: rework ratio, lower-is-better, Diamond state, tier progression, live strip,
badges, and standings.

- [ ] **Step 2: Compose Live excerpt**

Use numbers-only session tiles, live pulse, elapsed time, and the YouTube-style chat rail with its
actual 500-character and 5-per-10-second limits.

- [ ] **Step 3: Compose empty-state excerpt**

Use the real CLI commands, no invented data, a source-safe Claude connection illustration, and an
explicit privacy explanation.

- [ ] **Step 4: Screenshot all three excerpts**

Expected: the three excerpts feel like one product and show the approved direction at realistic UI scale.

### Task 6: Final QA

**Files:**
- Inspect Figma pages `00 — Visual Direction Sample` and `Wireframes — low-fi`

- [ ] **Step 1: Run structural validation**

Confirm the sample page has the planned named sections and the wireframe page still has nine route frames.

- [ ] **Step 2: Run clipping and overlap checks**

Check every text node's bounds against its nearest container and visually inspect section screenshots.

- [ ] **Step 3: Fix defects only at their source**

Resize text containers or adjust auto-layout; do not flatten, detach, or rewrite unrelated content.

- [ ] **Step 4: Capture final page and section screenshots**

Expected: no clipping, overlap, missing icons, placeholder shapes, or inconsistent stroke weights.

