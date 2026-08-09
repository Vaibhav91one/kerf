# Kerf FigJam Architecture and Flowchart Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Kerf architecture diagrams and flowcharts to match the existing HLD while preserving their architecture and flow semantics.

**Architecture:** Use the HLD nodes as live style tokens, then update one FigJam page at a time with explicit node mappings, section containment, role-based colors, and deliberate straight or elbowed routing. Each page is audited structurally and rendered after mutation before work proceeds to the next page.

**Tech Stack:** Figma MCP `use_figma`, FigJam Plugin API, `get_figjam`, `get_screenshot`

---

## Target Map

**Files:**

- Reference: `docs/superpowers/specs/2026-08-09-kerf-figjam-architecture-flow-restyle-design.md`
- Plan: `docs/superpowers/plans/2026-08-09-kerf-figjam-architecture-flow-restyle.md`
- External target: Kerf FigJam file `EuViTi5StQyv5uWSiOhO3X`

**Pages and protected artifacts:**

- Main page `16:438`; protect sequence section `3:91` and descendants.
- Backend page `20:124`; protect tables `5:207`, `5:280`, connector `5:369`, and descendants.
- Frontend page `21:61`; restyle both architecture and dashboard-flow diagrams.

**HLD style sources:**

- Outer section `8:337`
- Client section `8:344`
- Application section `8:351`
- Green shape `8:338`
- Purple shape `8:345`
- Neutral shape `8:352`
- Blue database `8:355`
- Neutral connector `8:360`

### Task 1: Capture a Recoverable Baseline and HLD Style Tokens

**Target:** FigJam file `EuViTi5StQyv5uWSiOhO3X`

- [ ] **Step 1: Save a pre-restyle version**

Run one `use_figma` call and return the version result:

```javascript
const result = await figma.saveVersionHistoryAsync(
  "Before architecture and flowchart restyle",
  "Baseline before applying the approved HLD visual system",
)
return { version: result }
```

- [ ] **Step 2: Read exact HLD paints and connector properties**

Run on Main page `16:438`:

```javascript
const page = await figma.getNodeByIdAsync("16:438")
if (!page || page.type !== "PAGE") throw new Error("Main page not found")
await figma.setCurrentPageAsync(page)

const ids = ["8:337", "8:344", "8:351", "8:338", "8:345", "8:352", "8:355", "8:360"]
const result = {}
for (const id of ids) {
  const node = await figma.getNodeByIdAsync(id)
  if (!node) throw new Error(`Missing HLD style source ${id}`)
  result[id] = {
    type: node.type,
    fills: "fills" in node ? node.fills : null,
    strokes: "strokes" in node ? node.strokes : null,
    strokeWeight: "strokeWeight" in node ? node.strokeWeight : null,
    sectionContentsHidden: node.type === "SECTION" ? node.contentsHidden : null,
  }
}
return result
```

Expected: exact fill/stroke arrays for every source node, with no missing IDs.

- [ ] **Step 3: Capture protected-artifact geometry**

Return `x`, `y`, `width`, `height`, and child counts for `3:91`, `5:207`, and `5:280`, plus endpoint/cap data for `5:369`. Keep this returned object for final comparison.

- [ ] **Step 4: Render all three baseline pages**

Call `get_screenshot` in parallel for `16:438`, `20:124`, and `21:61` with `maxDimension: 2400` and `contentsOnly: false`.

### Task 2: Restyle the Main Metrics Flowchart

**Target nodes:** `2:35`, `2:38`, `2:41`, `2:44`, `2:47`, `2:50`, `2:53`, `2:56`, `2:61`, `2:64`, `2:67`, and connectors `2:70` through `2:110`.

- [ ] **Step 1: Create and populate a flowchart section**

On Main page `16:438`, create a section named `Kerf - Metrics Ingestion & Dashboard Flow`, position it at `(60, 1350)`, and resize it to `(3640, 560)`. Capture each target node's page-relative `x`/`y`, append shapes first and connectors second, then restore coordinates relative to the section origin.

Return the created section ID and every moved node ID.

- [ ] **Step 2: Apply HLD role colors**

Clone and reassign the sampled HLD fills/strokes using this mapping:

```javascript
const styleMap = {
  "2:35": "green",
  "2:38": "neutral",
  "2:41": "purple",
  "2:44": "neutral",
  "2:47": "red",
  "2:50": "green",
  "2:53": "neutral",
  "2:56": "blue",
  "2:61": "purple",
  "2:64": "purple",
  "2:67": "green",
}
```

Derive red from the existing Reject node `2:47`; do not invent a new red.

- [ ] **Step 3: Route the flowchart**

Keep aligned linear connectors `2:70`, `2:74`, `2:78`, `2:90`, `2:102`, `2:106`, and `2:110` straight with explicit `RIGHT` to `LEFT` magnets. Set branch connectors `2:82`, `2:86`, `2:94`, and `2:98` to `ELBOWED` with explicit side magnets; use green strokes for Yes and red strokes for No.

Expected: all lines terminate on visible node edges and remain inside the section.

- [ ] **Step 4: Validate Main visually**

Render the new flowchart section and the full Main page. Confirm the sequence section `3:91` is unchanged from Task 1.

- [ ] **Step 5: Save a Main-page checkpoint**

Save Figma version history as `Restyled Main architecture flow`.

### Task 3: Restyle the Backend Architecture Diagram

**Target section:** `20:125`

**Target nodes:** `20:126`, `20:130`, `20:134`, `20:138`, `20:142`, `20:146`

**Target connectors:** `20:152`, `20:156`, `20:160`, `20:164`, `20:168`

- [ ] **Step 1: Apply the HLD section and node styles**

Use the HLD outer-section fill on `20:125`. Map runtime and shared-library nodes to green, authentication/validation/routes to purple or neutral by responsibility, and PostgreSQL `20:146` to blue.

- [ ] **Step 2: Normalize architecture routing**

Keep `20:152` and `20:156` straight with `BOTTOM` to `TOP` magnets. Set `20:160`, `20:164`, and `20:168` to `ELBOWED` with explicit `RIGHT` to `LEFT` magnets.

- [ ] **Step 3: Render and inspect section `20:125`**

Confirm labels do not overlap lines and every connector remains inside the section.

### Task 4: Restyle the Backend Processing Flowchart

**Target nodes:** `4:157`, `4:158`, `4:163`, `4:166`, `4:169`, `4:174`, `4:175`, `4:182`, `4:185`

**Target connectors:** `4:188` through `4:224`

- [ ] **Step 1: Create the state-flow section**

Create `Kerf - Metric Processing & Qualification Flow` at `(60, 1000)` with size `(2580, 620)`. Reparent only the listed state nodes and connectors while preserving their visual positions relative to the new section.

- [ ] **Step 2: Apply role colors**

Use green for start/extracted/stored/qualifying/tiered, purple for uploaded, red for rejected/not-qualifying, and neutral for the terminal marker.

- [ ] **Step 3: Use deliberate elbow routing**

Keep the aligned start, sync, qualifying-to-tiered, and not-qualifying-to-end paths straight. Set pass/fail branches and convergence paths to `ELBOWED` with explicit side magnets. Use green for pass/qualifying branches and red for fail/below-floor/rejected branches.

- [ ] **Step 4: Validate Backend visually**

Render page `20:124`. Expected natural width is below `3000` px, with no connector crossing an unrelated state. Compare protected table/ER geometry with Task 1.

- [ ] **Step 5: Save a Backend-page checkpoint**

Save Figma version history as `Restyled Backend architecture flows`.

### Task 5: Restyle the Frontend Architecture Diagram

**Target section:** `21:62`

**Target nodes:** `21:63`, `21:67`, `21:71`, `21:75`, `21:79`, `21:85`, `21:91`

**Target connectors:** `21:97`, `21:101`, `21:105`, `21:109`, `21:113`, `21:117`

- [ ] **Step 1: Apply the HLD visual system**

Use the HLD outer-section fill on `21:62`; map the runtime/entry node to green, page routes and deferred work to purple, and API data-source cylinders to blue.

- [ ] **Step 2: Route architecture branches**

Use straight connectors for already aligned pairs and `ELBOWED` connectors for Home-to-Season, Home-to-Insights, and Home-to-Deferred. Every elbow must use explicit side magnets.

- [ ] **Step 3: Render section `21:62`**

Confirm the architecture reads from runtime to Home, then into season, insights, and deferred branches without line-label collisions.

### Task 6: Restyle and Recompose the Frontend Dashboard Flowchart

**Target nodes:** `9:383`, `9:386`, `9:389`, `9:394`, `9:397`, `9:400`, `9:405`, `9:382`, `13:446`, `13:449`

**Target connectors:** `9:408` through `9:440`, `13:454`, `13:458`

- [ ] **Step 1: Create the dashboard-flow section**

Create `Kerf - Dashboard Navigation & Data Flow` at `(100, 1750)` with size `(2000, 1900)`. Reparent the listed nodes and connectors, including nested deferred section `9:382` and its children.

- [ ] **Step 2: Recompose nodes into readable clusters**

Use these section-local anchor positions:

```javascript
const positions = {
  "9:383": [800, 100],
  "9:386": [800, 340],
  "9:405": [250, 650],
  "13:446": [1450, 650],
  "9:389": [250, 950],
  "13:449": [1450, 950],
  "9:394": [250, 1250],
  "9:397": [50, 1550],
  "9:400": [500, 1550],
  "9:382": [650, 1150],
}
```

After positioning, resize the section only if needed to preserve at least `48` px around every child.

- [ ] **Step 3: Apply role colors**

Use green for Open Dashboard and Distribution, purple for page routes and Deferred, blue for API cylinders, neutral for the decision, and red for the empty state.

- [ ] **Step 4: Route navigation and data flow**

Use straight connectors for vertical Home-to-API, API-to-Decision, Decision-to-Empty, Insights-to-Sessions API, and Open-to-Home paths. Use explicit-magnet `ELBOWED` connectors for Home-to-Season, Home-to-Insights, Home-to-Deferred, Season-to-API, Decision-to-Distribution, and Distribution-to-Season.

Use green for `Yes` and red for `No`; keep other connectors neutral.

- [ ] **Step 5: Validate Frontend visually**

Render the new section and full page `21:61`. Expected natural width is below `2500` px. Confirm no line passes through unrelated nodes or section titles.

- [ ] **Step 6: Save a Frontend-page checkpoint**

Save Figma version history as `Restyled Frontend architecture flows`.

### Task 7: Run the Final Structural and Visual Audit

**Target:** All three pages

- [ ] **Step 1: Audit connector integrity in parallel**

Run one page-isolated `use_figma` audit per page:

```javascript
const connectors = page.findAllWithCriteria({ types: ["CONNECTOR"] })
const issues = []
for (const connector of connectors) {
  for (const [side, endpoint] of [["start", connector.connectorStart], ["end", connector.connectorEnd]]) {
    if (!endpoint || !("endpointNodeId" in endpoint)) {
      issues.push({ id: connector.id, side, kind: "floating" })
      continue
    }
    const target = await figma.getNodeByIdAsync(endpoint.endpointNodeId)
    if (!target) issues.push({ id: connector.id, side, kind: "missing-target" })
    if ("position" in endpoint && target && target.type !== "CONNECTOR") {
      issues.push({ id: connector.id, side, kind: "raw-position-on-shape" })
    }
  }
  if (connector.width > 4000 || connector.height > 4000) {
    issues.push({ id: connector.id, kind: "runaway-bounds" })
  }
}
return { connectorCount: connectors.length, issueCount: issues.length, issues }
```

Expected on every page: `issueCount: 0`.

- [ ] **Step 2: Render all three final pages**

Call `get_screenshot` in parallel for `16:438`, `20:124`, and `21:61` with `maxDimension: 2400` and `contentsOnly: false`.

- [ ] **Step 3: Compare protected artifacts**

Compare geometry and child counts for sequence section `3:91`, tables `5:207` and `5:280`, and ER connector `5:369` against Task 1. Expected: exact match.

- [ ] **Step 4: Perform final visual review**

Confirm HLD-consistent sections and colors, compact elbow routes, attached endpoints, readable labels, no unrelated-node crossings, and no clipping on all three rendered pages.

- [ ] **Step 5: Save the completed board version**

Save Figma version history as `Completed HLD-consistent architecture and flowchart restyle`.

