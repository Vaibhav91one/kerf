# Kerf Material 3 Platform Design

## Objective

Turn all nine Kerf low-fidelity wireframes into a polished, implementation-ready platform design
using the supplied Material 3 Design Kit as the structural reference. Add the work on one new page
inside Figma file `VdPEaCxSvkLqEKibE5qpRE`; leave `Wireframes — low-fi` and every existing page
unchanged.

The finished page must support both light and dark presentation through shared semantic variables
and reusable component instances. It is a product design and its local design system together, not
a collection of detached mockups.

## Figma page structure

Create one page named `Material 3 — Platform`. Organize it into these top-level sections:

1. `00 — Cover & Guidance`
2. `01 — Foundations`
3. `02 — Components`
4. `03 — Screens / Light`
5. `04 — Screens / Dark`

Sections must be clearly labelled and spaced so each can be inspected or exported independently.
No screen, component, or documentation frame may overlap another.

## Material 3 adaptation

Use the supplied Material 3 Community Design Kit
(`61NsMT42mJA7N7wr3cbRHJ`) as the reference for semantic color roles, component anatomy, state
layers, typography hierarchy, elevation, shape, and interaction states. Adapt those principles to a
desktop web product; do not paste mobile system UI, keyboards, device frames, or unrelated utility
components into Kerf.

Kerf keeps its product identity:

- SUSE for interface text and SUSE Mono for metrics, timestamps, ratios, commands, hashes, and
  compact technical labels.
- A restrained developer-tool tone rather than a generic mobile app or esports dashboard.
- Rework ratio is always presented as lower-is-better.
- Streaks and badges are display-only and never appear to affect ranking.
- Privacy copy remains visible where supplied by the wireframes.

## Foundations

### Variables

Create a local semantic variable collection with `Light` and `Dark` modes. Use Material 3 role names
where practical and add Kerf-specific roles only when Material roles cannot express the product
meaning.

Required color roles:

- `primary`, `on-primary`, `primary-container`, `on-primary-container`
- `secondary`, `on-secondary`, `secondary-container`, `on-secondary-container`
- `tertiary`, `on-tertiary`, `tertiary-container`, `on-tertiary-container`
- `surface`, `surface-container-lowest`, `surface-container-low`, `surface-container`,
  `surface-container-high`, `surface-container-highest`, `on-surface`, `on-surface-variant`
- `outline`, `outline-variant`, `inverse-surface`, `inverse-on-surface`
- `error`, `on-error`, `error-container`, `on-error-container`
- Kerf semantic roles for `live`, `success`, and the five tier families: Bronze, Silver, Gold,
  Platinum, and Diamond.

Tier colors distinguish rank without replacing text labels. Light and dark values must preserve the
same semantic meaning and readable contrast.

### Type, spacing, shape, and elevation

- Define named text styles for display, headline, title, body, label, and mono data roles.
- Use a 4 px base spacing scale with named values suitable for implementation tokens.
- Define a small Material-inspired shape scale and avoid excessive pill containers.
- Define a restrained elevation scale for menus, dialogs, floating controls, and emphasized cards.
- Document the 1440 px desktop grid, 260 px expanded sidebar, content margins, gutters, and common
  card padding.

## Components

Build local components with Auto Layout, sensible resizing, semantic names, and exposed properties.
Use variants for state, size, emphasis, selection, and relevant content options. Theme differences
must come from variables rather than duplicated component sets.

Required component families:

- App shell: sidebar, navigation group, navigation item, account/CLI footer, page header.
- Actions: filled, tonal, outlined, text, and icon buttons.
- Inputs: text field, select, search, textarea, switch, checkbox, and form helper/error text.
- Navigation and filtering: tabs, filter chips, segmented controls, breadcrumb where needed.
- Feedback: tooltip, snackbar, banner/callout, dialog, skeleton, progress indicator, and status dot.
- Data display: metric card, tier chip, badge, avatar, list row, data table, histogram/bar treatment,
  progress/threshold track, code block, and empty-state panel.
- Kerf product components: season summary, tier ladder, live-session card, project card, skill bar,
  standings row, session row, privacy callout, CLI connection step, and chat message/composer.

Components must include the states visible or implied by the wireframes: default, hover, focus,
pressed, selected, disabled, error, loading, earned/locked, connected/disconnected, and live/ended
where applicable.

## Screen inventory

Recreate every existing wireframe at its original desktop frame size and content scope. Produce one
Light and one Dark instance of each:

1. `01 / — Home`
2. `02 /live — Live sessions and chat`
3. `03 /u/[handle] — Public profile`
4. `04 /skills — Public skill usage`
5. `05 /projects — Build-in-public projects`
6. `06 /me — Account and CLI connection`
7. `07 /season — Season distribution and standings`
8. `08 /insights — Personal sessions and numeric tips`
9. `09 / — Honest empty state`

The two theme sections therefore contain 18 full product frames. Screen hierarchy may be refined,
but routes, product meaning, values, privacy constraints, and truthful empty states must not change.

## Layout and responsive behavior

The deliverable is desktop-first at the wireframes' 1440 px width. Components must use Auto Layout,
hug/fill constraints, min/max-safe text containers, and consistent content grids so engineers can
translate them into responsive web layouts. The component documentation should identify intended
sidebar collapse behavior and card/table wrapping behavior, but no separate mobile screen set is in
scope.

All labels must fit their nodes. Text clipping, truncated privacy statements, overlapping cards,
and fixed-width components that break when labels grow are release blockers.

## Code handoff rules

- Use names that map cleanly to React and shadcn-style component boundaries.
- Prefer semantic variables over raw colors and magic-number styling.
- Use component instances in screens; detached visual copies are not acceptable.
- Keep data-bearing layers named by role rather than by sample value.
- Add concise component descriptions for non-obvious Kerf rules, especially lower-is-better ranking,
  display-only gamification, public-skills opt-in, rate-limited chat, and privacy-safe telemetry.
- Preserve content that can map directly to the existing API response shapes.

## Verification

After construction:

1. Confirm `Wireframes — low-fi` is unchanged.
2. Confirm exactly one new page named `Material 3 — Platform` was added.
3. Confirm all required variable modes, text styles, component families, and 18 screen frames exist.
4. Inspect screenshots of foundations, components, and every screen in both themes.
5. Check for clipping, overlap, dead space, inconsistent icon weight, broken instances, and low
   contrast.
6. Confirm screens use component instances and semantic variables rather than detached duplicates.
7. Confirm Light and Dark screens have the same information architecture and content.

## Acceptance criteria

- The new page reads as one coherent, production-quality Material 3 desktop platform.
- Light and Dark modes are both complete and derive from one shared system.
- All nine routes are represented in both modes.
- Components, variants, variables, styles, Auto Layout, naming, and documentation support direct
  design-to-code work.
- Material 3 structure is recognizable without erasing Kerf's developer-product identity.
- Existing Figma pages and source wireframes remain untouched.
- No text is clipped, no layers overlap unintentionally, and important text and controls have
  accessible contrast.
