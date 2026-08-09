# Kerf Material 3 Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one implementation-ready Material 3 platform page to the Kerf Figma file, containing a shared dual-theme design system and all nine routes in Light and Dark modes.

**Architecture:** Build one local semantic variable collection with Light and Dark modes, then create reusable Material 3 and Kerf product components that consume those variables. Assemble nine Light screens from component instances, duplicate them for Dark, and change only the explicit variable mode so both sets remain structurally identical.

**Tech Stack:** Figma Design, official Figma MCP, Figma Plugin API, Material 3 Community Design Kit, SUSE, SUSE Mono, Auto Layout, variables, component properties, variants.

---

## File and canvas structure

**Local files:**

- Reference: `docs/superpowers/specs/2026-08-09-kerf-material-3-platform-design.md`
- Create: `docs/superpowers/plans/2026-08-09-kerf-material-3-platform.md`
- Modify after Figma verification: `BUILD_LOG.md`

**Figma files:**

- Product file to modify: `VdPEaCxSvkLqEKibE5qpRE`
- Material 3 reference file, read-only: `61NsMT42mJA7N7wr3cbRHJ`
- Source page, read-only: `0:1`, `Wireframes — low-fi`
- New page: `Material 3 — Platform`

**New page sections:**

- `00 — Cover & Guidance`
- `01 — Foundations`
- `02 — Components`
- `03 — Screens / Light`
- `04 — Screens / Dark`

### Task 1: Load Figma guidance and capture the immutable baseline

**Files:**

- Read: `docs/superpowers/specs/2026-08-09-kerf-material-3-platform-design.md`
- Inspect: Figma files `VdPEaCxSvkLqEKibE5qpRE` and `61NsMT42mJA7N7wr3cbRHJ`

- [ ] **Step 1: Load the official Figma skills**

Read the Figma skill index, then load `figma-use`, `figma-design-to-code`, and
`figma-generate-library`. Read every directly required reference named by those skills before the
first write operation.

- [ ] **Step 2: Record the product-file baseline**

Use `get_metadata` on product node `0:1`. Record the existing page names, the nine source frame IDs,
their names, dimensions, and the source page's top-level child count. Do not change selection or
nodes.

Expected source inventory:

```text
16:4    01 / — Home
16:150  02 /live
16:264  03 /u/[handle]
18:2    04 /skills
18:114  05 /projects
18:218  06 /me
19:2    07 /season
19:143  08 /insights
19:274  09 / — empty state
```

If an ID differs, use the frame name discovered from metadata and update this plan's execution notes
before proceeding; never guess a node ID.

- [ ] **Step 3: Read the source designs and Material 3 references**

Call `get_design_context` for the nine source frames in three batches of three. Search the Material
3 file separately for these single intents: semantic color roles, navigation drawer, button, card,
text field, chip, dialog, switch, data table, and progress indicator. Treat results as structural
references; do not import mobile keyboard, device-frame, status-bar, or navigation-bar utilities.

- [ ] **Step 4: Capture baseline screenshots**

Capture the source page and each source frame. Save the returned URLs/metadata in the execution log
for final before/after comparison.

### Task 2: Create the page, sections, variables, styles, and foundation specimens

**Figma:**

- Create page: `Material 3 — Platform`
- Create sections: `00 — Cover & Guidance`, `01 — Foundations`

- [ ] **Step 1: Create the page safely**

Use `use_figma` to query all pages by name. Abort the write if `Material 3 — Platform` already
exists; report the existing page ID instead of creating a second copy. Otherwise create exactly one
page and set it current with `await figma.setCurrentPageAsync(page)`.

- [ ] **Step 2: Create the semantic color collection**

Create collection `Kerf / Semantic` with modes `Light` and `Dark`. Add every role required by the
spec. Use Material 3 role naming and these Kerf accents:

```text
Primary seed: #566500 light / #C7D874 dark
Live:         #006A67 light / #4CDAD4 dark
Success:      #386A20 light / #9CD67D dark
Error:        #BA1A1A light / #FFB4AB dark
Bronze:       #8A4F28 light / #E7B68E dark
Silver:       #59616C light / #C0C7D2 dark
Gold:         #735C00 light / #E8C54A dark
Platinum:     #435E6B light / #AAC9D8 dark
Diamond:      #006B5D light / #56DBC3 dark
```

Build surface/on-surface, container/on-container, outline, inverse, and error pairs with readable
contrast. Bind every foundation specimen to variables; no raw fill should remain in component-ready
specimens except neutral annotation backgrounds.

- [ ] **Step 3: Create numeric token collections**

Create `Kerf / Spacing` values `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`; `Kerf / Radius` values
`0, 4, 8, 12, 16, 24, full`; and `Kerf / Elevation` values `0, 1, 2, 3`. Document the mapping from
elevation level to surface role and shadow treatment.

- [ ] **Step 4: Create type styles**

Load SUSE and SUSE Mono before changing text. Create named styles for Material-style display,
headline, title, body, and label tiers, plus `Data/Metric`, `Data/Body`, `Data/Label`, and
`Data/Command`. Use SUSE Mono only for values, commands, timestamps, ratios, hashes, and compact
technical labels.

- [ ] **Step 5: Build foundation documentation**

Create `00 — Cover & Guidance` and `01 — Foundations` sections with Auto Layout specimen frames for
color roles in both modes, typography, spacing, radius, elevation, icon rules, and the 1440 px grid.
Document the 260 px expanded sidebar, 40 px content margin, 24 px content gutter, and 24 px default
card padding.

- [ ] **Step 6: Verify foundations**

Use `get_metadata` and `get_screenshot` on both sections. Confirm both color modes exist, labels fit,
all styles are named, and the foundation frames have no overlapping children.

### Task 3: Build the reusable component library

**Figma:**

- Create section: `02 — Components`

- [ ] **Step 1: Build Material foundation components**

Create component sets for buttons, icon buttons, text fields, text areas, selects, switches,
checkboxes, tabs, chips, tooltips, snackbars, banners, dialogs, skeletons, progress indicators,
status dots, avatars, badges, list rows, and data-table primitives. Use Auto Layout and expose text,
boolean, instance-swap, and variant properties where useful.

Variant axes must use consistent names:

```text
Type=Filled|Tonal|Outlined|Text
Size=Small|Medium|Large
State=Default|Hover|Focus|Pressed|Disabled|Error|Loading
Selected=False|True
Status=Default|Live|Ended|Connected|Disconnected|Earned|Locked
```

Only apply an axis where it has meaning; do not generate a Cartesian product of irrelevant states.

- [ ] **Step 2: Build the application shell**

Create `Shell/App`, `Shell/Sidebar`, `Navigation/Group`, `Navigation/Item`, `Shell/Account Footer`,
and `Shell/Page Header`. The sidebar must support `Expanded=True|False`, selected navigation state,
and connected/disconnected footer status. Use a single rounded-stroke icon family on 24 px boxes.

- [ ] **Step 3: Build Kerf data-display components**

Create `Data/Metric Card`, `Data/Tier Chip`, `Data/Badge`, `Data/Progress Track`, `Data/Skill Bar`,
`Data/Table Header`, `Data/Table Row`, `Data/Code Block`, and `Feedback/Privacy Callout`. Tier and
badge components must always include text so color is not the only signal.

- [ ] **Step 4: Build Kerf product components**

Create `Kerf/Season Summary`, `Kerf/Tier Ladder`, `Kerf/Live Session Card`, `Kerf/Project Card`,
`Kerf/Standings Row`, `Kerf/Session Row`, `Kerf/CLI Connection Step`, `Kerf/Chat Message`,
`Kerf/Chat Composer`, and `Kerf/Empty State`. Add concise descriptions for lower-is-better ranking,
display-only gamification, public-skills opt-in, chat limits, and privacy-safe telemetry.

- [ ] **Step 5: Verify the component section**

Query descendants and assert every required component/component-set name exists. Confirm no
component has an empty name, screens have not been created yet, and all specimen labels fit. Capture
a screenshot at sufficient resolution to inspect states and variable bindings.

### Task 4: Assemble all nine Light screens

**Figma:**

- Create section: `03 — Screens / Light`

- [ ] **Step 1: Create the screen grid**

Create a horizontal three-column grid with 160 px gaps and three rows. Add nine 1440 px-wide frames,
preserving each source frame's height. Set the section to the `Light` mode of `Kerf / Semantic`.

- [ ] **Step 2: Assemble Home, Live, and Profile**

Build `01 / — Home`, `02 /live — Live sessions and chat`, and `03 /u/[handle] — Public profile`
using instances from `02 — Components`. Preserve all wireframe values and privacy language. Keep
the Home tier direction lower-is-better and show live/chat limits exactly as the source does.

- [ ] **Step 3: Assemble Skills, Projects, and Account**

Build `04 /skills — Public skill usage`, `05 /projects — Build-in-public projects`, and
`06 /me — Account and CLI connection`. Preserve public-skill opt-in copy, project field limits,
shown-once token language, and the exact list of data that leaves the machine.

- [ ] **Step 4: Assemble Season, Insights, and Empty State**

Build `07 /season — Season distribution and standings`, `08 /insights — Personal sessions and
numeric tips`, and `09 / — Honest empty state`. Preserve tier cuts, numeric tip triggers, qualifying
rules, three CLI commands, and the no-fake-data explanation.

- [ ] **Step 5: Verify Light screens**

Capture metadata and screenshots for all nine frames. Assert each frame contains instances, uses the
expanded shell, has no clipped visible text, and matches the source route content. Fix defects before
creating Dark screens.

### Task 5: Produce Dark mode from the shared system

**Figma:**

- Create section: `04 — Screens / Dark`

- [ ] **Step 1: Duplicate the verified Light frames**

Clone the nine Light screen frames and preserve component instances. Place them in the same
three-column grid under `04 — Screens / Dark`. Do not detach instances or rebuild screen content.

- [ ] **Step 2: Apply the Dark variable mode**

Set the explicit mode of `Kerf / Semantic` to `Dark` on the Dark section or each Dark screen frame.
Do not change information architecture, text, spacing, component variants, or sample data.

- [ ] **Step 3: Apply theme-specific elevation only where necessary**

Use the documented Dark surface hierarchy and restrained light-edge/shadow treatments for overlays.
Do not introduce neon glows, purple-blue AI gradients, or mode-specific layout changes.

- [ ] **Step 4: Verify structural parity**

For every Light/Dark screen pair, compare dimensions, descendant instance count, text content, and
top-level layout order. Only variable-driven visual properties and documented elevation may differ.

### Task 6: Perform full visual and structural QA

**Figma:**

- Inspect page: `Material 3 — Platform`
- Reinspect source page: `Wireframes — low-fi`

- [ ] **Step 1: Run structural assertions**

Use `use_figma` in read-only mode to return:

```text
new page count named Material 3 — Platform = 1
top-level section count on new page = 5
Light screen count = 9
Dark screen count = 9
duplicate component names = 0
unnamed components = 0
detached screen-level component copies = 0
```

- [ ] **Step 2: Run bounding-box checks**

For every section and screen, compare each visible child's absolute bounding box against its parent
and siblings. Report text outside parents, unintended sibling intersections, zero-sized visible
nodes, and components that exceed their frame. Fix every reported defect.

- [ ] **Step 3: Inspect screenshots**

Capture the five top-level sections and all 18 screens at a resolution high enough to read labels.
Review hierarchy, contrast, icon weight, dead space, density, table alignment, focus states, and
Light/Dark parity. Correct every clipping or overlap defect; these are release blockers.

- [ ] **Step 4: Prove the source is unchanged**

Re-run the Task 1 metadata snapshot on `Wireframes — low-fi`. Compare source frame IDs, names,
dimensions, top-level child count, and screenshot appearance against the baseline.

- [ ] **Step 5: Final metadata inventory**

Return the new page ID, variable collections/modes, text-style count, component/component-set count,
the 18 screen IDs, and screenshots for the five sections. Keep this inventory for the handoff.

### Task 7: Record the completed design handoff

**Files:**

- Modify: `BUILD_LOG.md`

- [ ] **Step 1: Add the Figma result to the build log**

Append a dated entry containing the existing Figma file URL, new page name and ID, Light/Dark screen
count, component and variable summary, verification result, and the statement that the low-fi page
remained unchanged.

- [ ] **Step 2: Verify the documentation diff**

Run:

```bash
git diff --check -- BUILD_LOG.md
git diff -- BUILD_LOG.md
```

Expected: no whitespace errors; only the new Material 3 handoff entry is present.

- [ ] **Step 3: Commit the handoff**

```bash
git add BUILD_LOG.md
git commit -m "docs: record Kerf Material 3 platform"
```

- [ ] **Step 4: Deliver the result**

Return the direct Figma page link, a concise inventory of the design-system artifacts and 18
screens, confirmation that the source page is unchanged, and any remaining limitation discovered by
verification.
