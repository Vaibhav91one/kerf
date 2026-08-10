# Kerf Assets Library Design

## Objective

Create a dedicated Figma page named `Assets — Kerf` in design file
`VdPEaCxSvkLqEKibE5qpRE`. The page will establish a reusable visual-asset library before any new
assets are applied to the production screens on `Material 3 — Platform`.

The library adds personality without changing Kerf's information-dense developer-product tone. It
contains solid interface icons, illustrated people avatars, and a small family of compact product
illustrations. All assets are editable vectors, named for implementation, and previewed in both
light and dark contexts.

## Approved visual direction

- Use bold, filled Material-style icon silhouettes rather than thin outline icons.
- Use Kerf lime selectively for selected and positive states, cyan for live activity, forest green
  for primary actions, and semantic tier colors only when rank is the meaning.
- Use distinct illustrated people for community avatars. Vary skin tone, hair, clothing, and
  silhouette while keeping one shared construction system.
- Use restrained editorial illustrations with two to four semantic colors. Illustrations support
  empty, onboarding, live, analytics, and publishing moments; they never compete with product data.
- Preserve SUSE and SUSE Mono, the existing Material 3 semantic variables, and the warm Kerf
  light/dark surfaces.
- Do not edit the production screens during this phase.

## Figma page structure

Create one new top-level page named `Assets — Kerf` with five horizontally separated sections:

1. `00 — Cover & Usage`
2. `01 — Solid Icons`
3. `02 — People Avatars`
4. `03 — Product Illustrations`
5. `04 — Light & Dark Proofs`

Each section has a title, a short usage note, specimen labels, and enough spacing to inspect or
export it independently. The page must not reuse the oversized presentation boards from the screen
page; it is a compact working asset library.

## Solid icon system

### Form

- Use filled 24 px masters on a 24 × 24 view box.
- Favor simple geometric silhouettes, stable optical weight, and rounded internal corners.
- Keep important negative spaces open at 16 px rendered size.
- Avoid decorative containers inside icon components. Colored circles or rounded squares belong to
  the consuming UI, not the glyph master.
- Create vectors as editable Figma paths and expose color through existing semantic variables.

### Initial inventory

Build the assets required by the current nine routes and their common actions:

- Navigation: Home, Live, Season, Insights, Projects, Skills, People, Account.
- Product: Terminal, Trophy, Badge, Activity, Timer, Upload, Git branch, Folder, Privacy.
- Actions: Add, Search, Copy, External link, More, Chevron right, Check, Close, Menu.

Every icon component uses the naming convention `Kerf/Asset/Icon/<Name>`. Provide specimens at
16, 20, 24, and 32 px through instance scaling examples rather than duplicating vector masters.

### Semantic color specimens

Show each core icon family in `OnSurface`, `Primary`, `Live`, `Success`, and `OnPrimaryContainer`
roles. The component master remains semantically bound; light/dark values come from variable modes.

## Illustrated avatar system

Create twelve distinct people plus one generic fallback. Use the names already visible in the
wireframes for the first seven identities: Vaibhav, Ada, June, Theo, Mira, Sol, and Rune. The
remaining five are reusable community identities, not celebrities or depictions of real people.

### Construction

- Circular crop with a solid semantic background.
- Head-and-shoulders composition with a clear face silhouette at 32 px.
- Shared eye, nose, mouth, shoulder, and crop geometry; vary hair, facial hair, glasses, clothing,
  skin tone, and background color.
- Use flat fills with one subtle secondary shade. Avoid gradients, photographic texture, and tiny
  facial details.
- Keep the set friendly and adult, with varied gender presentation and appearance.
- Add a live-status dot only in usage examples, not inside the avatar master.

Name components `Kerf/Asset/Avatar/<Identity>`. Show 24, 32, 40, 56, and 80 px specimens and a
generic fallback with a solid person silhouette.

## Product illustration system

Create five original compact SVG scenes:

1. `CLI Sync` — terminal prompt, local machine, and a privacy-safe outgoing signal.
2. `Empty Season` — an unfilled ranking card and a clear first-step cue.
3. `Live Activity` — three participant signals converging on a live pulse.
4. `Insights` — rework-ratio bars trending toward a lower value.
5. `Publish Project` — code or terminal output moving into a public project card.

Illustrations use one dark neutral, one surface neutral, Kerf lime, and one context accent. They use
the same rounded geometry as the icon system, remain legible between 120 and 320 px, and contain no
embedded text. Name them `Kerf/Asset/Illustration/<Name>`.

## Light and dark behavior

- Every icon and illustration color binds to existing Kerf semantic variables.
- Dark mode changes surfaces, outlines, and foregrounds through variables; it does not duplicate
  the asset component family.
- Avatars retain identity colors across themes, with a theme-aware outline for separation.
- Provide side-by-side light and dark proof cards for core icons, four avatars, and all five
  illustrations.
- Avoid using lime for large illustration backgrounds in dark mode; reserve it for focal elements.

## Implementation handoff

- Keep asset masters on the Assets page and use component instances everywhere else.
- Use slash-delimited component names that map cleanly to code exports.
- Add concise descriptions covering intended meaning and misuse.
- Preserve a 24 px icon view box and record each illustration's intrinsic aspect ratio.
- Use SVG-compatible vector primitives so engineers can export or reproduce the assets without
  raster cleanup.
- Do not flatten avatar or illustration groups unless Figma requires it for a boolean operation.

## Verification

1. Confirm exactly one new page named `Assets — Kerf` exists.
2. Confirm the existing wireframes and `Material 3 — Platform` screens are unchanged.
3. Confirm 25 solid icon masters, 13 avatar masters, and 5 illustration masters exist.
4. Confirm every master is an editable component and every specimen is an instance.
5. Inspect the full page plus focused screenshots of icons, avatars, illustrations, and theme proofs.
6. Check optical alignment at 16 px, avatar clarity at 24 px, and illustration clarity at 120 px.
7. Confirm all content fits its frame with no clipping or overlap.
8. Confirm semantic variable bindings resolve correctly in Light and Dark modes.

## Acceptance criteria

- The Assets page reads as one coherent Kerf visual family rather than unrelated icon, avatar, and
  illustration styles.
- Solid icons are recognizable, optically consistent, and usable at interface sizes.
- Avatars are distinct at a glance, inclusive, and still readable at compact sizes.
- Illustrations add product meaning without inventing data or weakening privacy messaging.
- Asset names, vectors, variables, components, and usage notes support direct design-to-code work.
- No production screen changes occur until the asset page is separately reviewed and approved.
