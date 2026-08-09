# Kerf FigJam Architecture and Flowchart Restyle

## Objective

Restyle the Kerf FigJam architecture diagrams and flowcharts so they use the same visual language as the existing `Kerf - Architecture & Deployment (HLD)` section. Preserve the documented architecture and flow semantics while improving grouping, routing, and scanability.

Target board: `https://www.figma.com/board/EuViTi5StQyv5uWSiOhO3X`

## Scope

Restyle these diagrams:

- Main page: metrics ingestion and dashboard flowchart.
- Backend page: Express/Prisma/Postgres architecture diagram.
- Backend page: metric processing and qualification state flow.
- Frontend page: Next.js/backend architecture diagram.
- Frontend page: dashboard navigation and data flowchart.

Keep these artifacts unchanged:

- Main page sequence diagram.
- Backend page database tables and relationship connector.
- Diagram text, architecture meaning, route names, state names, and decision labels except for minor line wrapping required by layout.

## Visual System

Use the existing HLD as the source of truth for styling:

- Pale tinted sections group each complete diagram and carry a concise title.
- Green nodes represent clients, user entry points, local inputs, and successful outcomes.
- Purple nodes represent application services, routes, processing, and frontend/backend components.
- Blue nodes represent databases and API-backed data sources.
- Neutral white nodes represent routing, transformations, calculations, and decisions.
- Red nodes represent rejection, failure, and empty outcomes.
- Connector strokes remain neutral by default; successful decision branches are green and failure branches are red.

Reuse the HLD's existing FigJam fill and stroke values rather than introducing a new palette.

## Layout

Each diagram will sit inside one section with consistent internal margins. Primary flows should read left-to-right; vertical branching is acceptable when it produces shorter routes and clearer decision outcomes.

Nodes may be repositioned to:

- Keep related steps aligned.
- Prevent connectors from crossing unrelated nodes or labels.
- Keep decision outcomes visually distinct.
- Keep connectors within the owning section.

The Frontend dashboard flow may retain its navigation branches, but the season, insights, deferred, API, decision, success, and empty-state nodes must form readable clusters instead of one long mixed graph.

## Connectors

Use `ELBOWED` connectors where a single horizontal/vertical bend improves readability. Use explicit `TOP`, `BOTTOM`, `LEFT`, or `RIGHT` magnets on both endpoints; do not use `AUTO` magnets on elbowed flowchart connectors.

Straight connectors are allowed only when nodes are already aligned and an elbow would add no information. Connector endpoints must visibly terminate on node edges. Labels must not overlap nodes, section titles, or other connector labels.

## Validation

After restyling, verify all three pages structurally and visually:

- Every connector endpoint references an existing node.
- No shape endpoint uses a raw pixel-position attachment.
- No connector creates runaway canvas bounds.
- Architecture and flowchart connectors visibly meet their nodes.
- Diagram sections contain their visual content with consistent margins.
- No connector or label crosses an unrelated node where repositioning can avoid it.
- The sequence diagram and database tables remain unchanged.

