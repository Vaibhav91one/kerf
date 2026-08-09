# Kerf visual-direction sample

## Objective

Create one isolated Figma Design page named `00 — Visual Direction Sample` in file
`VdPEaCxSvkLqEKibE5qpRE`. The existing `Wireframes — low-fi` page and all nine route frames remain
untouched. The sample is an approval artifact for the eventual high-fidelity design system, not the
design-system library itself.

## Product idea carried into the visual language

Kerf is the material lost while making a cut. The interface should therefore feel like a precise
developer instrument that exposes waste and rewards cleaner work. It should not look like a generic
SaaS dashboard or a neon esports product.

The primary motif is a diagonal cut through a measured grid: noisy activity enters, a clean metric
leaves. This motif appears in the Kerf mark, tier crests, progress tracks, chart markers, dividers,
and selected states.

## Visual direction

- Dark-first graphite canvas with subtly tinted surfaces and fine structural borders.
- SUSE for interface hierarchy; SUSE Mono for metrics, commands, timestamps, hashes, and thresholds.
- Electric lime as the Kerf action/selection color, cyan for live state, coral for rejection/error,
  and Claude terracotta only where Claude source identity is shown.
- Tier metals are distinct but controlled: bronze, silver, gold, cool platinum, and mint diamond.
- Depth comes from surface tint, inner borders, restrained glow, grid texture, and layered panels;
  there are no generic black shadows or purple-blue AI gradients.

## Icon system

- Interface icons use the Phosphor regular SVG family on a 24×24 optical box.
- Source branding uses the Claude silhouette from Simple Icons rather than an imitation.
- Kerf-specific tier and achievement icons are custom editable SVGs.
- All custom icons use the same 48×48 grid, 2.5–3px rounded stroke language, inset, corner treatment,
  and `cut` notch motif.
- Tier progression is communicated by a shared crest container with increasing internal rank detail,
  not five unrelated pictograms.
- Achievement icons map to the six product badges in `packages/shared/src/game.ts`: Clean Run,
  Diamond Session, Diamond x5, Steady Hand, 3-Day Streak, and 7-Day Streak.

## Sample-page content

The page contains a single dark presentation board with these sections:

1. Hero and brand premise: Kerf mark, wordmark, positioning, and cut-path motif.
2. Foundations: palette, typography, surface depth, spacing, radii, and motion principles.
3. Icon language: navigation icons, Claude source card, five tier crests, and six badge icons.
4. Component specimens: sidebar, metric cards, progress, live session card, privacy callout, command
   block, table treatment, and empty-state illustration.
5. Three high-fidelity excerpts: Home, Live, and the honest empty state.

## Content constraints

- Use only routes already present in the nine wireframes.
- Rework ratio remains lower-is-better and the tier ladder must preserve that direction.
- Streaks and badges are display-only and never presented as ranking inputs.
- Transcript-derived data remains numbers, hashes, enums, and timestamps only.
- Ghosts never receive names, avatars, or live-feed positions.
- All labels must be sized to content; clipped or overlapping text is a release blocker.

## Acceptance criteria

- Exactly one new page exists and the wireframe page is unchanged.
- Every icon is editable vector content with a named semantic purpose.
- Claude, navigation, tier, badge, live, privacy, CLI, and chart icons are visually consistent.
- Home, Live, and empty-state excerpts feel like the same product and demonstrate the direction at
  real UI scale.
- Screenshots of each major section show no clipping, overlap, accidental dead space, or illegible
  contrast.
- The page is clearly labelled as a direction sample, not a completed component library.

