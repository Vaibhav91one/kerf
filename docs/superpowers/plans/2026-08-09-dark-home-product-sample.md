# Dark Home Product Sample Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one polished 1440 × 1200 dark-mode Home dashboard in the existing Figma Design file and create its reusable Tier Momentum illustration on the assets page.

**Architecture:** Preserve wireframe frame `16:4` as immutable source truth. Build the high-fidelity screen incrementally on a new page from local Figma variables, text styles, reusable icon components, and two illustration components; validate each major subtree before composing the final page.

**Tech Stack:** Figma Design, Figma Plugin API, official Figma MCP tools, SUSE, SUSE Mono, editable SVG/vector paths

---

### Task 1: Discover and lock source truth

**Files:**
- Read: Figma file `VdPEaCxSvkLqEKibE5qpRE`, frame `16:4`
- Read: `BUILD_LOG.md`
- Read: `CLAUDE.md`
- Create: `/tmp/design-system-state-dark-home-2026-08-09.json`

- [ ] **Step 1: Inspect the Home source frame**

Read metadata and a screenshot for `16:4`. Record the sidebar labels, all visible values, section order, and 1440 × 1200 bounds. Expected sections: season header, four metrics, tier ladder, live sessions, badges, and standings.

- [ ] **Step 2: Inspect the target file conventions**

List pages, variables, styles, and components. Confirm that `Assets — Streak Fire` and `Illustration / Streak Fire` exist and that `03 — Dark Product Sample / Home` does not yet contain a finished screen.

- [ ] **Step 3: Search libraries before creating assets**

Search subscribed libraries separately for navigation icons, analytics icons, trophy/tier icons, and status icons. Reuse an asset only when its stroke family and editable component API are consistent across the full set.

- [ ] **Step 4: Create the state ledger**

Record all discovered and subsequently created Figma IDs under collections, variables, styles, pages, frames, components, and pending validations. Never reconstruct an ID from memory.

### Task 2: Create the dark Home foundations

**Files:**
- Modify in Figma file `VdPEaCxSvkLqEKibE5qpRE`: local variables and text styles

- [ ] **Step 1: Create the `Kerf Dark UI` variable collection**

Create one `Dark` mode and the following COLOR variables with targeted scopes and Web syntax:

```text
color/bg/canvas       #080A0F  FRAME_FILL
color/bg/sidebar      #0B0E14  FRAME_FILL
color/bg/card         #111620  FRAME_FILL, SHAPE_FILL
color/bg/card-raised  #161C28  FRAME_FILL, SHAPE_FILL
color/bg/accent-soft  #2A1710  FRAME_FILL, SHAPE_FILL
color/border/subtle   #222A38  STROKE_COLOR
color/border/strong   #344052  STROKE_COLOR
color/text/primary    #F5F7FB  TEXT_FILL
color/text/secondary  #A9B2C3  TEXT_FILL
color/text/muted      #6F7A8E  TEXT_FILL
color/accent/orange   #FF4B1A  SHAPE_FILL, TEXT_FILL, STROKE_COLOR
color/accent/amber    #FFA018  SHAPE_FILL, TEXT_FILL, STROKE_COLOR
color/accent/gold     #FFF097  SHAPE_FILL, TEXT_FILL, STROKE_COLOR
color/status/live     #41D6A3  SHAPE_FILL, TEXT_FILL, STROKE_COLOR
color/status/info     #78A7FF  SHAPE_FILL, TEXT_FILL, STROKE_COLOR
```

Use `var(--kerf-...)` Web syntax for every variable.

- [ ] **Step 2: Create spacing and radius variables**

Create FLOAT variables in the same collection: `space/1=4`, `space/2=8`, `space/3=12`, `space/4=16`, `space/6=24`, `space/8=32`, `radius/sm=8`, `radius/md=12`, `radius/lg=18`, and `radius/xl=24`. Use `GAP` or `CORNER_RADIUS` scope and Web syntax.

- [ ] **Step 3: Create typography styles**

Verify SUSE and SUSE Mono availability, load exact style names, then create:

```text
Kerf/Display      SUSE Bold       40/48
Kerf/Heading      SUSE SemiBold   24/32
Kerf/Title        SUSE SemiBold   16/24
Kerf/Body         SUSE Regular    14/20
Kerf/Label        SUSE Medium     11/16, +0.6 px tracking
Kerf/Metric       SUSE Mono Bold  30/36
Kerf/Mono Small   SUSE Mono       12/18
```

If a named style is unavailable, choose the nearest verified style from the same family and record the substitution in the state ledger.

- [ ] **Step 4: Validate foundations**

Return collection ID, mode name, variable count, missing scopes, missing Web syntax, and text-style list. Expected: 1 new collection, 25 variables, 7 text styles, zero missing scopes, and zero missing syntax.

### Task 3: Build reusable assets

**Files:**
- Modify Figma page `Assets — Streak Fire` (`75:6`)

- [ ] **Step 1: Create `Illustration / Tier Momentum`**

Build a transparent 240 × 180 component from named editable vectors: `Diamond / Back`, `Diamond / Face Left`, `Diamond / Face Right`, `Orbit / Arc`, `Orbit / Progress Marks`, and `Flame / Accent`. Bind fills and strokes to Kerf variables. Position it away from the existing Streak Fire documentation.

- [ ] **Step 2: Create or reuse the icon family**

Provide 20 × 20 consistent rounded-stroke components for: Home, Live, Season, Insights, Projects, Skills, People, Privacy, Ratio, Tier, Streak, Qualifying, Watch, and External Link. Prefer a complete subscribed-library family; otherwise import editable SVG paths with 1.75–2 px rounded strokes.

- [ ] **Step 3: Create tier marks**

Create five 20 × 20 editable tier components for Bronze, Silver, Gold, Platinum, and Diamond using one geometric system. Use color differences and silhouette changes without relying on text.

- [ ] **Step 4: Validate assets**

Verify component names, dimensions, vector child counts, variable bindings, and duplicate counts. Capture a screenshot of the Tier Momentum asset and the icon/tier grid on a dark documentation surface.

### Task 4: Build page skeleton and sidebar

**Files:**
- Create in Figma: page `03 — Dark Product Sample / Home`
- Create in Figma: frame `Home / Dark Product Sample`, 1440 × 1200

- [ ] **Step 1: Create the destination page and root frame**

Create or reuse the deterministic page name. Add a 1440 × 1200 root frame bound to `color/bg/canvas`; set clips content to true and position it at 0,0.

- [ ] **Step 2: Build the 260 px sidebar shell**

Create a 260 × 1200 vertical auto-layout sidebar bound to `color/bg/sidebar`, with 20 px outer padding, grouped PLATFORM and BUILD IN PUBLIC navigation, and a footer user/CLI block. Instantiate the correct icon component beside each label.

- [ ] **Step 3: Build the content shell**

Create the main content frame at x=260, width=1180, height=1200 with 40 px horizontal padding and 32 px vertical spacing. Add the season title, explanatory copy, a privacy chip, and the divider.

- [ ] **Step 4: Validate skeleton**

Capture metadata and screenshot. Confirm exact root/sidebar dimensions, no overflow, correct active Home state, and no overlap between sidebar and content.

### Task 5: Build the season hero and metrics

**Files:**
- Modify Figma frame `Home / Dark Product Sample`

- [ ] **Step 1: Build the hero card**

Create a 1100 × 300 raised card with the ratio `0.167`, Diamond tier, `avg over 12 sessions`, the lower-is-better explanation, and an instance of `Illustration / Tier Momentum`. Use metric and label text styles and bind all fills/strokes to variables.

- [ ] **Step 2: Build the tier ladder**

Create five equal tier steps inside the hero using tier-mark instances and the wireframe values: Bronze `p95 0.78`, Silver `p80 0.61`, Gold `p50 0.44`, Platinum `p20 0.21`, Diamond `best`. Emphasize Diamond without changing the data.

- [ ] **Step 3: Build streak and qualifying cards**

Create two 260 × 116 cards showing `5 days` and `12 / 31`. Use an instance of `Illustration / Streak Fire` in the streak card and the Qualifying icon in the second card. Preserve `display only, never ranked` and `floor: 3 turns + 1 edit`.

- [ ] **Step 4: Validate hero and metric hierarchy**

Screenshot the top section. Verify ratio, tier, streak, qualifying values, ladder order, illustration fit, icon clarity, and contrast.

### Task 6: Build live, badges, and standings sections

**Files:**
- Modify Figma frame `Home / Dark Product Sample`

- [ ] **Step 1: Build Live Now**

Create three equal live-session cards using the source data for `@ada`, `@june`, and `@theo`. Include live status, project, turns, edits, rework value, and a compact progress rail. Keep the `Watch all` action.

- [ ] **Step 2: Build badges**

Create six compact badge tiles using source labels and earned/locked states: clean-run, diamond-session, diamond-x5, steady-hand, streak-3, and streak-7. Use the matching tier/streak/general icons and make locked state distinct without losing legibility.

- [ ] **Step 3: Build standings**

Create the five-row standings table using source handles, average ratios, tiers, and session counts. Apply SUSE Mono to ratios and numbers; use tier marks beside tier text.

- [ ] **Step 4: Validate lower sections**

Screenshot the live, badge, and standings region. Confirm every source value, earned/locked state, row alignment, table column alignment, and no clipped labels.

### Task 7: Final QA and review handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-08-09-dark-home-product-sample.md`
- Read: Figma source frame `16:4`
- Read: Figma destination frame `Home / Dark Product Sample`

- [ ] **Step 1: Audit source preservation**

Re-read metadata for `16:4` and confirm its node name, position, size, and child count match the discovery snapshot.

- [ ] **Step 2: Audit structure and token bindings**

Verify deterministic page/frame/component names, unique component counts, 1440 × 1200 root size, expected section hierarchy, icon instances, illustration instances, and variable-bound fills/strokes.

- [ ] **Step 3: Audit accessibility and visual polish**

Check text/background contrast, 16 px minimum icon clarity, active/locked/live state differentiation, consistent radii, consistent borders, baseline alignment, clipping, and overflow.

- [ ] **Step 4: Capture final screenshots**

Capture the full Home page at sufficient resolution and separate screenshots of the hero and assets. Inspect all three visually and make targeted fixes before handoff.

- [ ] **Step 5: Record completion**

Mark plan checkboxes complete, commit only this plan update, and provide direct Figma links to the new page and Tier Momentum component for user review.
