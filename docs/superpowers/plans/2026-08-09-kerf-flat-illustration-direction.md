# Kerf Flat Illustration Direction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third, isolated Figma presentation page that applies preset unDraw flat SVG scenes to the complete Kerf light-platform sample without changing the wireframes or either existing direction page.

**Architecture:** Clone the validated `01 — Light Platform Direction` board so typography, layout, icons, tiers, badges, and product components remain identical at the system level. Create a new unDraw source tray, remove every Khagwal image node from the clone, then replace illustration moments section-by-section with traceable unDraw SVG clones. Validate every section visually and finish with programmatic page-integrity, typography, theme, overflow, and provenance audits.

**Tech Stack:** Figma Plugin API through official Figma MCP, unDraw SVG illustrations, SUSE/SUSE Mono, Phosphor-style SVG interface icons, Simple Icons Claude mark, shell read-only/download commands, Git documentation.

---

## File and document boundaries

- Existing approved spec: `docs/superpowers/specs/2026-08-09-kerf-flat-illustration-direction-design.md`
- This implementation plan: `docs/superpowers/plans/2026-08-09-kerf-flat-illustration-direction.md`
- Temporary source assets: `/private/tmp/kerf-undraw-flat/`
- Target Figma file: `VdPEaCxSvkLqEKibE5qpRE`
- Protected Figma pages: `0:1`, `26:2`, and `41:2`
- Source page to clone: `41:2`
- Source board to clone: `41:3`
- New page name: `02 — Flat Illustration Direction`
- New board name: `Kerf / Flat Illustration Direction v1`

### Task 1: Capture immutable baselines

- [ ] **Step 1: Read the protected page structures**

Use three read-only Figma calls, changing page at most once per call. Record these expected baselines:

```text
Wireframes — low-fi (0:1): 20 top-level nodes, 9 top-level frames
00 — Visual Direction Sample (26:2): 1 top-level node, 7 board sections
01 — Light Platform Direction (41:2): 2 top-level nodes, 7 board sections, 9 source-asset frames
```

- [ ] **Step 2: Capture reference screenshots**

```text
41:3  — complete light board
44:11 — brand
44:13 — visual language
44:15 — Home
44:16 — Live
44:17 — Empty State
```

Expected: each screenshot renders successfully and provides the comparison baseline for the flat page.

### Task 2: Acquire and verify exact unDraw presets

- [ ] **Step 1: Create an isolated temporary asset directory**

Run:

```bash
mkdir -p /private/tmp/kerf-undraw-flat
```

- [ ] **Step 2: Download the exact current unDraw SVGs from the official CDN without modifying the repository**

Run:

```bash
curl -L -o /private/tmp/kerf-undraw-flat/design-components.svg \
  https://cdn.undraw.co/illustration/design-components_c2hs.svg
curl -L -o /private/tmp/kerf-undraw-flat/code-thinking.svg \
  https://cdn.undraw.co/illustration/code-thinking_tqs9.svg
curl -L -o /private/tmp/kerf-undraw-flat/growth-analytics.svg \
  https://cdn.undraw.co/illustration/growth-analytics_vzjz.svg
curl -L -o /private/tmp/kerf-undraw-flat/reading-time.svg \
  https://cdn.undraw.co/illustration/reading-time_jva3.svg
curl -L -o /private/tmp/kerf-undraw-flat/detailed-answer.svg \
  https://cdn.undraw.co/illustration/detailed-answer_kys9.svg
curl -L -o /private/tmp/kerf-undraw-flat/idea-to-plan.svg \
  https://cdn.undraw.co/illustration/idea-to-plan_jnei.svg
curl -L -o /private/tmp/kerf-undraw-flat/next-task.svg \
  https://cdn.undraw.co/illustration/next-task_jtbr.svg
```

Expected source files:

```text
/private/tmp/kerf-undraw-flat/design-components.svg
/private/tmp/kerf-undraw-flat/code-thinking.svg
/private/tmp/kerf-undraw-flat/growth-analytics.svg
/private/tmp/kerf-undraw-flat/reading-time.svg
/private/tmp/kerf-undraw-flat/detailed-answer.svg
/private/tmp/kerf-undraw-flat/idea-to-plan.svg
/private/tmp/kerf-undraw-flat/next-task.svg
```

- [ ] **Step 3: Verify SVG identity and structure**

Run:

```bash
for asset in design-components code-thinking growth-analytics reading-time detailed-answer idea-to-plan next-task; do
  test -s "/private/tmp/kerf-undraw-flat/${asset}.svg" || exit 1
done
rg -n '<svg|viewBox|<path' /private/tmp/kerf-undraw-flat/{design-components,code-thinking,growth-analytics,reading-time,detailed-answer,idea-to-plan,next-task}.svg
```

Expected: all seven files exist, contain one SVG root, a viewBox, and vector paths.

- [ ] **Step 4: Prepare Kerf-accent variants mechanically**

Each official SVG uses `#6c63ff` as its editable accent. Create one source-preserving copy per
semantic role with only that exact fill replaced:

```bash
cp /private/tmp/kerf-undraw-flat/design-components.svg /private/tmp/kerf-undraw-flat/design-components-kerf.svg
cp /private/tmp/kerf-undraw-flat/code-thinking.svg /private/tmp/kerf-undraw-flat/code-thinking-kerf.svg
cp /private/tmp/kerf-undraw-flat/growth-analytics.svg /private/tmp/kerf-undraw-flat/growth-analytics-kerf.svg
cp /private/tmp/kerf-undraw-flat/reading-time.svg /private/tmp/kerf-undraw-flat/reading-time-kerf.svg
cp /private/tmp/kerf-undraw-flat/detailed-answer.svg /private/tmp/kerf-undraw-flat/detailed-answer-kerf.svg
cp /private/tmp/kerf-undraw-flat/idea-to-plan.svg /private/tmp/kerf-undraw-flat/idea-to-plan-kerf.svg
cp /private/tmp/kerf-undraw-flat/next-task.svg /private/tmp/kerf-undraw-flat/next-task-kerf.svg
perl -pi -e 's/#6c63ff/#276C3D/g' /private/tmp/kerf-undraw-flat/{design-components,code-thinking,idea-to-plan}-kerf.svg
perl -pi -e 's/#6c63ff/#187E87/g' /private/tmp/kerf-undraw-flat/{growth-analytics,reading-time}-kerf.svg
perl -pi -e 's/#6c63ff/#D97757/g' /private/tmp/kerf-undraw-flat/detailed-answer-kerf.svg
perl -pi -e 's/#6c63ff/#D65A4A/g' /private/tmp/kerf-undraw-flat/next-task-kerf.svg
```

Resulting mapping:

```text
design-components → #276C3D
code-thinking → #276C3D
growth-analytics → #187E87
reading-time → #187E87
detailed-answer → #D97757
idea-to-plan → #276C3D
next-task → #D65A4A
```

Expected: geometry, viewBox, neutral fills, and skin colors are unchanged; only the library's editable accent differs.

### Task 3: Create the isolated page and cloned board

- [ ] **Step 1: Create the new page**

Use one Figma mutation call:

```javascript
const source = await figma.getNodeByIdAsync('41:3');
const page = figma.createPage();
page.name = '02 — Flat Illustration Direction';
await figma.setCurrentPageAsync(page);
const board = source.clone();
page.appendChild(board);
board.name = 'Kerf / Flat Illustration Direction v1';
board.x = 0;
board.y = 0;
return { pageId: page.id, boardId: board.id, sectionIds: board.children.map(n => n.id) };
```

Expected: a new page contains one 1,600 × 7,900 board with seven section frames.

- [ ] **Step 2: Remove inherited Khagwal content from the clone**

Within the new board only, remove nodes whose name contains `Khagwal` or whose descendant has an image fill inherited from the Khagwal page. Preserve the surrounding cards and stages.

Expected audit:

```javascript
const khagwal = board.findAll(n => n.name.toLowerCase().includes('khagwal'));
return { khagwalCount: khagwal.length };
```

Expected: `khagwalCount` is `0`.

- [ ] **Step 3: Create the provenance tray beside the board**

Create a 980 px-wide white frame at `x = 1680`, `y = 0` named `unDraw / Source Assets`. Add:

```text
unDraw flat illustration source assets
Preset SVGs · Kerf accent variants · unDraw license
https://undraw.co/illustrations · https://undraw.co/license
```

Expected: tray is the page's second top-level node and contains no product UI.

### Task 4: Import and stage the seven flat scenes

- [ ] **Step 1: Upload each prepared SVG into the new page**

Upload the seven Kerf-accent SVGs. Move returned nodes into the source tray and name them exactly:

```text
unDraw / Design components / Kerf green
unDraw / Code thinking / Kerf green
unDraw / Growth analytics / Live cyan
unDraw / Reading time / Live cyan
unDraw / Detailed answer / Claude terracotta
unDraw / Idea to plan / Kerf green
unDraw / Next task / Rework coral
```

- [ ] **Step 2: Normalize source specimens without changing artwork geometry**

Place assets in a two-column specimen grid. Give each source frame a white fill, `#DDE4DA` border, 16 px corner radius, and a caption. Scale each SVG proportionally inside its specimen frame.

Expected: all seven source frames are visible, retain their original viewBox proportions, and have no raster image fills.

- [ ] **Step 3: Screenshot the source tray**

Expected: seven visually coherent unDraw scenes, correct labels, and readable provenance copy.

### Task 5: Convert Brand, Foundations, and Visual Language

- [ ] **Step 1: Update Brand premise**

Clone `unDraw / Design components / Kerf green` into the existing right-hand hero stage. Remove 3D-specific provenance copy and replace it with:

```text
Preset flat SVG · unDraw · Kerf accent variant
```

Keep the value proposition, action chips, and rework curve unchanged.

- [ ] **Step 2: Update Foundations**

Keep semantic colors, type, and surface elevation specimens unchanged. Replace the two contextual 3D objects with scaled clones of `Growth analytics` and `Detailed answer`, labeled `Operational insight` and `Guided support`.

- [ ] **Step 3: Update Visual Language**

Keep navigation icons, Claude mark, tier crests, and six badges unchanged. Replace the Khagwal row with seven small, labeled unDraw scene specimens and the label:

```text
unDraw flat illustration library · editable semantic accent · preset SVG
```

- [ ] **Step 4: Validate the three sections**

Capture screenshots of all three nodes. Expected: no clipped labels, no 3D artwork, and a consistent flat family.

### Task 6: Convert Component specimens

- [ ] **Step 1: Preserve functional components**

Keep button, field, metric, sidebar-07, and table geometry and tokens unchanged.

- [ ] **Step 2: Add illustration-vs-icon guidance**

Replace any inherited 3D content with a compact `Next task` guidance card. Add the rule:

```text
Icons operate the interface. Flat scenes explain a state or outcome.
```

- [ ] **Step 3: Validate the section screenshot**

Expected: all controls remain functional-looking, and the scene is clearly contextual rather than clickable.

### Task 7: Convert Home

- [ ] **Step 1: Replace the recommended-session artwork**

Insert `Code thinking` into the right side of the forest-green recommended-session card. Place it on a white or pale-green contained stage so the original dark-neutral portions retain contrast.

- [ ] **Step 2: Replace league artwork**

Use a compact crop of `Growth analytics` inside the league card while preserving `#12`, percentile copy, and movement data.

- [ ] **Step 3: Validate Home**

Expected: dashboard density, sidebar-07, cards, data, and actions match the light sample; only illustration direction changes.

### Task 8: Convert Live

- [ ] **Step 1: Replace timed-study artwork**

Use `Reading time` inside the focused-time card while preserving the 11:42 value and no-context-switches copy.

- [ ] **Step 2: Preserve official Claude identity**

Keep the official Claude glyph. Use `Detailed answer` only as a small explanatory scene inside or adjacent to the optional hint card; do not replace the Claude mark.

- [ ] **Step 3: Keep privacy functional and text-led**

Remove inherited Khagwal artwork from the privacy card and use the established 24 px Phosphor-style
shield icon beside the existing privacy copy. Do not place an unDraw scene in this control-sized
card or imply that illustration artwork is a security control.

- [ ] **Step 4: Validate Live**

Expected: question flow remains dominant, help remains optional, and no artwork resembles a control.

### Task 9: Convert Empty State

- [ ] **Step 1: Replace the hero composition**

Use one large `Idea to plan` scene centered on the pale stage. Remove all inherited multi-object 3D content.

- [ ] **Step 2: Preserve the guided first-run structure**

Keep the three steps, one primary create-goal CTA, sample-path alternative, measurable-progress message, and privacy statement.

- [ ] **Step 3: Add a restrained supporting scene**

Use `Next task` only in the bottom outcomes/trust band. Do not combine multiple large scenes in the hero.

- [ ] **Step 4: Validate Empty State**

Expected: the first action is immediately clear, the hero remains spacious, and the scene reads as premium rather than playful clip art.

### Task 10: Run final programmatic and visual audits

- [ ] **Step 1: Audit new-page structure**

Expected:

```text
Page top-level nodes: 2
Board size: 1600 × 7900
Board section count: 7
Source tray asset count: 7
```

- [ ] **Step 2: Audit illustration provenance**

Run a recursive node-name and fill audit on the new page.

Expected:

```text
Names containing Khagwal: 0
Raster IMAGE fills: 0
Large illustration source names beginning with unDraw: 7 source nodes plus section clones
```

- [ ] **Step 3: Audit typography and theme**

Expected:

```text
All text fonts: SUSE or SUSE Mono
Dark fills #080A0B, #101416, #151B1E: 0
Missing-font text layers: 0
```

- [ ] **Step 4: Audit direct-child bounds**

For every section, flag any direct child where `x < -1`, `y < -1`, `x + width > section.width + 1`, or `y + height > section.height + 1`.

Expected: zero overflow results.

- [ ] **Step 5: Re-check protected baselines**

Expected:

```text
0:1  — 20 top-level nodes, 9 frames
26:2 — 1 top-level node, 7 sections
41:2 — 2 top-level nodes, 7 sections, 9 Khagwal source frames
```

- [ ] **Step 6: Capture final screenshots**

Capture the source tray, all seven sections, and the complete board. Inspect for clipping, overlap, unintended dark surfaces, inconsistent illustration scale, and weak hierarchy.

- [ ] **Step 7: Deliver the handoff**

Provide the direct Figma node link for the new board, note that existing pages and FigJam remain unchanged, and cite unDraw library and license provenance.
