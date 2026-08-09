# Kerf light-only library-led sample update

## Objective

Create a new Figma page named `01 — Light Platform Direction` in design file
`VdPEaCxSvkLqEKibE5qpRE`. The new page translates the approved sample structure into a light-only,
premium product-platform direction. The existing `00 — Visual Direction Sample` page is retained
exactly as the dark-direction reference. The `Wireframes — low-fi` page, its nine route frames, the
three-page FigJam board, and every other Figma file also remain untouched.

This new page remains a visual-direction sample rather than the production component library. It
must show enough foundations, assets, component specimens, and real screen context to compare the
light and dark directions before the nine wireframes are converted.

## Approved direction

- Light-only interface with a warm ivory application canvas and white primary surfaces.
- Modern product-platform character: calm, precise, dimensional, and operational rather than
  playful, sterile, or finance-dashboard generic.
- SUSE remains the interface typeface; SUSE Mono remains reserved for metrics, timestamps, tokens,
  commands, percentiles, and status metadata.
- Forest green carries accessible actions and selected states. Acid lime becomes a restrained
  highlight rather than the dominant surface color.
- Depth comes from subtle warm-grey borders, layered whites, soft shadows, controlled highlights,
  and preset 3D library assets. Glass effects, neon glow, dark surfaces, and purple-blue AI gradients
  are excluded.

## Core light palette

| Role | Value | Usage |
| --- | --- | --- |
| Canvas | `#F7F8F4` | Application and presentation-board background |
| Surface | `#FFFFFF` | Primary cards, dialogs, tables, and navigation |
| Soft surface | `#EFF3EC` | Secondary grouping, selected rows, and illustration stages |
| Border | `#DDE4DA` | Structural dividers and default outlines |
| Ink | `#162019` | Headings and primary body copy |
| Muted | `#667269` | Supporting copy and metadata |
| Action green | `#276C3D` | Primary controls, active navigation, and accessible positive text |
| Highlight lime | `#A8E85C` | Progress, focus accents, and restrained brand moments |
| Live cyan | `#187E87` | Live telemetry and connected states |
| Rework coral | `#D65A4A` | Reversals, destructive actions, and errors |
| Claude terracotta | `#D97757` | Claude source identity only |

All text and control combinations must meet WCAG AA contrast at the sizes shown. Lime is not used as
small text on white; action green carries that semantic role.

## Illustration library decision

Large decorative and explanatory imagery uses preset assets from the **Khagwal 3D** Figma Community
library, not AI-generated or newly drawn illustrations:

- Community file: `https://www.figma.com/community/file/998617366015604829/Khagwal-3D---Free-3D-Illustration-Library-Pack`
- Publisher site: `https://3d.khagwal.com/`
- License: CC0 Public Domain; commercial and personal use are allowed without attribution.
- Selected family: **Amber**, perspective view, because its warm orange, green, cream, and subtle
  lilac materials complement Kerf's forest/lime palette on light surfaces.

Only original preset Khagwal renders may be used for illustration content. Permitted layout work is
limited to cropping, scaling, positioning, and combining those preset objects on a stage. The assets
must not be redrawn, traced, or presented as original Kerf artwork.

Approved asset mapping:

| Product meaning | Preset asset |
| --- | --- |
| Precision and goal | `dart_board` |
| Edits and work | `pencil` |
| Progress and achievement | `badge` |
| League success | `trophy` |
| Privacy and trust | `shield` or `lock` |
| Settings and system operation | `gear` |
| Live duration | `clock` |
| Notifications | `bell` |

The 3D objects are feature illustrations, not interface icons. Small controls continue to use the
Phosphor regular vector family. Claude continues to use its recognizable Simple Icons silhouette.
The Bronze-to-Diamond crests and six product-specific badge glyphs remain custom vectors because
generic 3D objects cannot communicate their exact progression or earning conditions.

## Layout and surface system

- The new presentation board is 1,600 px wide with seven vertically separated sections.
- Section containers become white with 24 px corners, a one-pixel border, and a low-opacity soft
  shadow. The board background becomes warm ivory.
- Application excerpts use white navigation and content surfaces over a soft neutral canvas.
- Primary cards use 16–20 px radii; compact controls use 10–12 px radii.
- Dividers remain visible but quiet. Dense tables use row tinting instead of dark fills.
- 3D assets sit on pale, tonal stages with ample negative space and no decorative gradients.

## Section-by-section update

### 01 — Brand premise

Convert the hero to a clean split composition. The left side carries the Kerf value proposition and
accessible action chips. The right side uses the Khagwal `dart_board`, `pencil`, and `badge` assets to
express focus, editing, and earned progress. The rework curve remains a product-data visualization,
not an illustration.

### 02 — Foundations

Replace the dark palette and surface samples with the approved light roles. Demonstrate three levels
of white/soft-surface elevation, the green/lime distinction, border treatment, and accessible status
colors. Khagwal `gear` and `shield` assets may appear as small contextual specimens.

### 03 — Icon language

Retain the semantic navigation, Claude source, tier, and badge structure. Recolor interface icons for
light surfaces and refine the crest containers for a premium enamel/metal appearance. Add a compact
"Illustration library" specimen showing the approved Amber `badge`, `trophy`, `shield`, `pencil`,
`gear`, `dart_board`, and `clock` assets with their semantic labels.

### 04 — Component specimens

Convert buttons, fields, sidebar-07, metrics, tables, toasts, and alerts to the light system. Primary
buttons use action green with white text. Lime is limited to focus/progress accents. Cards use subtle
shadows only when elevated above another white surface.

### 05 — Home direction

Rebuild the dashboard excerpt on a soft ivory canvas with a white sidebar and cards. Retain rework
ratio, recent sessions, live-session action, and league standing. Use the Khagwal `trophy` or `badge`
asset as the league-progress illustration rather than a custom decorative scene.

### 06 — Live direction

Rebuild live telemetry on white surfaces. Connected/live status uses cyan, reversals use coral, and
privacy information remains prominent. Use the Khagwal `clock` and `pencil` assets as restrained
session context while preserving aggregate-only activity and anonymous percentile ghosts.

### 07 — Honest empty state

Replace the custom cut-path illustration with a preset-asset composition using Khagwal
`dart_board`, `pencil`, and optionally `shield`. Preserve the three-step connect/work/close journey,
the local-first explanation, and the single primary action.

## Product and privacy constraints

- Rework ratio remains lower-is-better.
- Bronze, Silver, Gold, Platinum, and Diamond preserve the existing percentile direction.
- Streaks and badges remain display-only and never influence ranking.
- No free transcript text, prompts, code, or file contents are shown or implied as retained data.
- Ghosts remain anonymous percentile markers with no names, avatars, or live positions.
- Claude is a source identity, never a tier or achievement.

## Asset provenance and naming

Every imported library image must be named with its source and variant, for example:
`Khagwal 3D / Amber / trophy / perspective`. Each section using an asset should reference or clone
the same imported source node to prevent untracked visual variants. The page must include a short
provenance note naming Khagwal 3D and the CC0 license.

## Acceptance criteria

- The new `01 — Light Platform Direction` page is entirely light themed; no dark application or
  presentation surfaces remain on that page.
- Every large illustration comes from the approved Khagwal 3D Figma Community library.
- Library assets are visibly consistent in theme and angle and have semantic layer names.
- Interface icons remain coherent at 24 px and are not replaced by 3D artwork.
- Home, Live, and Empty excerpts feel like one premium product platform.
- Small text and controls meet WCAG AA contrast.
- The page has no missing fonts, clipped text, overlaps, or direct-child overflow.
- The original wireframe page still contains 20 top-level nodes and nine frames.
- The original `00 — Visual Direction Sample` page and its seven-section board are unchanged.
- The design file contains the wireframe page, the retained dark sample page, and the new light
  direction page.
- The FigJam file and all other Figma files remain unchanged.
