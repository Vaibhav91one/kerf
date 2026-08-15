# Build Log — Kerf

Running log of what's been done, in order. See `CLAUDE.md` for stack/scope, `HANDOFF.md` for design
history, `~/Documents/app-specs/kerf-spec.md` for the spec.

## 2026-08-09

### Zerops infrastructure

- Project `kerf` created (EU Central / prg1, Lightweight tier, $0/30d).
- 3 services provisioned: `backend` (Node.js 22.22.3), `frontend` (Node.js 22.22.3), `postgresql`
  (PostgreSQL 16.11, Single mode). Satisfies the hackathon's multi-service gating rule.
- Personal API access token generated for CLI/API deploy access, saved to `.zerops-token`
  (gitignored, never commit).
- Zerops MCP server (`zeropsio/zcp`) checked — **not connected in this session**. No `mcp__zerops__*`
  tools available. Zerops-side work done via browser automation instead.

### Monorepo scaffold

- pnpm workspace root (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`), mirroring
  `~/dev/cornice`'s conventions per HANDOFF.md.
- `packages/shared`: `schema.ts` (KerfEvent/SessionMetric types), `metrics.ts`
  (`computeSessionMetric`), `season.ts` (winsorized-median season score, percentile tier cuts).
  7/7 `node --test` cases pass.
- `apps/cli`: extractor (`extract.ts`), uploader (`upload.ts`), CLI entrypoint (`index.ts`).

### Extractor verification

- Found real Claude Code transcript schema differs from spec §5.4: no `origin.kind` field exists.
  Verified by direct inspection of live JSONL under `~/.claude/projects/`. Substituted a practical
  heuristic (documented in `extract.ts` and `CLAUDE.md`).
- `pnpm install` surfaced a real bug: `@kerf/shared` had no `main`/`exports` field, so workspace
  resolution failed (`ERR_MODULE_NOT_FOUND`). Fixed to match cornice's pattern
  (`main`/`types`/`exports` all pointing at `src/index.ts`).
- `node --test` surfaced a real test bug in `season.test.ts`: compared winsorized medians across
  *different-length* arrays (6 values vs. 5). Winsorizing clamps outlier magnitude but doesn't drop
  it, so array length — and therefore which index the median interpolates — differed between the two
  cases. Not a scoring bug. Fixed the test to use same-length arrays.
- `pnpm -r typecheck` surfaced a real type error in `upload.ts` (`res.json()` returns `unknown`).
  Fixed with an explicit cast on the response shape.
- Ran the CLI dry-run against the user's real `~/.claude/projects` corpus: **27 sessions parsed, 7
  qualify (§7.4 session-level floor), avg rework ratio 0.336**. (Originally scanned
  `~/.claude/projects` + `~/.claude-work/projects` together — 129/44/0.557 — but the user's machine
  actually has 6 `.claude*` profile dirs, not 2; user confirmed scope is default profile only, so
  `apps/cli/src/extract.ts`'s `ROOTS` was trimmed to just `~/.claude/projects`.)

### Scope decisions confirmed with user (not just code comments)

- Subagent transcripts not recursed tonight — main-session Edit/Write calls only. Confirmed.
- Season-level 5-commits-per-season floor not enforced tonight (no git connector) — session-level
  floor only. Confirmed.

### Diagrams

Built the full HLD/LLD diagram set in one FigJam board:
https://www.figma.com/board/EuViTi5StQyv5uWSiOhO3X

**Update (later still):** split the board from one giant single-page canvas into a proper
multi-page project — one FigJam page per diagram (Overview, Privacy Data Flow, Sequence, State, ERD,
Architecture & Deployment, Frontend Sitemap), each diagram's nodes moved to its own page and
repositioned near the origin. "Overview" (formerly Page 1, now empty of diagrams) became an index
page with a title + one sticky per diagram page.

**Update (bug found + fixed):** the coordinate-normalization step above shifted every top-level
node's `x`/`y` uniformly, including independent top-level CONNECTOR nodes on the DFD, State, ERD, and
Frontend Sitemap pages — connectors render from their bound-endpoint geometry (`connectorStart`/
`connectorEnd`, referencing node IDs), not from their own `x`/`y`, so writing to `x`/`y` directly
desynced the stored value from the actual rendered path and left every connector on those 4 pages
pointing at stray coordinates (confirmed visually — user reported "diagrams are all messed up").
Fix: reassign each connector's `connectorStart`/`connectorEnd` to itself with a valid `magnet` enum
(`'AUTO'`, since the getter's `'EDGE'` value isn't valid on the setter) — this forces Figma to
recompute the connector's geometry from its bound nodes. One connector didn't budge on the first pass
because reassigning an *already-`AUTO`* value is a no-op; fixed by toggling through a different
magnet value first. All 33 affected connectors across 4 pages fixed and re-verified via screenshot.

**Update (3-way architecture split):** split the single "Architecture & Deployment (HLD)" page into
3 pages per user request — "Architecture — Main (System Overview)" (renamed, content unchanged: CLI →
ingress → frontend/backend → Postgres), "Architecture — Backend" (new: Node 22/Express 5/TypeScript →
bearerAuth → validate.ts schema-walk → routes → `@kerf/shared` + Postgres 16 via Prisma 7), and
"Architecture — Frontend" (new: Next.js/Node 22 stack, `/`, `/season`, `/insights` branching to their
backend routes, deferred spec §8 routes, a sticky noting the frontend isn't built yet and is gated on
the design-system decision). Overview index page updated with 2 new stickies + the renamed one's text.
All content verified intact post-move (connectors, nested sections, table cells all survived the
cross-page reparent).

**Update (consolidated to 3 pages):** user rejected the resulting 9-page board ("i only wnat 3 pages
contain all the diagrams main, frontend backend") — too many pages, wanted every diagram folded into
exactly 3: Main, Backend, Frontend. Consolidated by reusing the 3 architecture pages as anchors and
merging the other 6 pages' content into them (stacked vertically below each page's existing content,
same connector-recompute fix as above applied to every moved connector rather than touching `x`/`y`
directly):
- **Main** = architecture overview + Privacy Data Flow (DFD) + Sequence (CLI Sync + Dashboard Read).
- **Backend** = backend architecture + State (SessionMetric Lifecycle) + ERD (`session_metric` +
  `season`).
- **Frontend** = frontend architecture + Frontend Sitemap & User Flow.
Overview index page (no longer needed with only 3 pages) and all 6 now-empty standalone pages
deleted. Final state: exactly 3 pages, each self-contained. Re-verified via screenshot — no new
overlaps introduced by the merge (checked bounding boxes numerically since combined page height makes
whole-page screenshots too zoomed-out to read).

- Architecture + Deployment (HLD, merged — hosting/region in node labels)
- Privacy Data Flow (DFD) — the zero-free-text invariant, spec §6
- Sequence — CLI sync + dashboard read (LLD)
- State — SessionMetric lifecycle: extracted → uploaded → rejected/stored → qualifying → tiered (LLD)
- ERD — `session_metric`/`session` + `season` tables (stands in for class diagram — unsupported by
  the diagram tool)

Skipped: standalone network diagram (Zerops abstracts networking, nothing distinct to draw
truthfully) and a standalone deployment diagram (folded into the architecture diagram instead of
drawing a near-duplicate).

**Update (later same night):** two more diagrams added to the same board.
- Architecture/Deployment (HLD) regenerated in place with the real tech stack on every node — Kerf
  CLI (Node 22, TS, `parseArgs`), Frontend (Next.js, Node 22), Backend API (Express 5, Prisma 7 + pg
  adapter, Node 22), PostgreSQL 16 (Zerops managed).
- Frontend Sitemap & User Flow — `/` and `/season`, the only two routes tonight's backend actually
  supports (`GET /api/season/current`). `/s/[sessionId]`, `/rivals`, `/live`, `/me` from spec §8 are
  shown in a separate greyed-out "Deferred" cluster, not wired up as if real — no backend route
  exists for any of them tonight.

### Backend

- `apps/backend`: Express + Prisma 7 (pg driver adapter, no Docker — local dev Postgres runs via
  `scripts/db.sh` on Apple's `container` runtime, port 5434, Postgres 16 to match Zerops).
- Schema: one table, `session_metrics` — no persisted `season` table tonight (ponytail: tier cuts
  computed live from qualifying rows in `GET /api/season/current`; documented upgrade path in
  `prisma/schema.prisma`).
- `src/validate.ts`: schema-walk validator, the actual privacy-invariant enforcement (spec §6) — any
  key not in the exact `SessionMetric` allow-list is rejected, not stored.
- `src/auth.ts`: bearer-token middleware, constant-time compare (`timingSafeEqual`).
- Routes: `GET /health`, `POST /api/metrics` (bearer-gated, schema-walks every array item, upserts
  accepted rows, returns accepted count + per-index rejection reasons), `GET /api/season/current`
  (current UTC month, qualifying rows only, tier cuts via `@kerf/shared`), `GET /api/me/sessions`
  (bearer-gated, own session history + tool-usage histogram + numeric-threshold tips — see "User
  dashboard" below).
- `pnpm install` needed a real fix: pnpm's interactive build-script prompt wrote
  `ignoredBuiltDependencies` for `@prisma/engines`/`prisma` into `pnpm-workspace.yaml` on the first
  (non-interactive) run, silently skipping their install scripts. Moved to `onlyBuiltDependencies` in
  `pnpm-workspace.yaml` and reinstalled clean — Prisma client now generates correctly.
- Full smoke test against a real local Postgres (not just typecheck/unit tests): started
  `scripts/db.sh up`, ran `prisma migrate dev`, booted the server, and curled all 3 routes —
  unauthenticated request correctly 401s, a payload with a smuggled `promptText` field is correctly
  rejected by the schema-walk while the valid row in the same batch is accepted, and
  `/api/season/current` correctly excludes an out-of-month row and includes a current-timestamp one
  with correct tier cuts. Torn down after (`scripts/db.sh down`).
- 4/4 `node --test` cases pass (`validate.test.ts`), typecheck clean.
- `zerops.yml` written for the `backend` service. **Not yet verified against the real Zerops
  project** — the `DATABASE_URL` env var reference (`${db_connectionString}`) is the documented Zerops
  convention but needs confirming against the actual generated env var name for the `postgresql`
  service before first deploy (task: deploy to Zerops).

### Codex review (backend, pre-frontend gate)

User asked for an independent Codex review of the backend before frontend work starts. Spawned via
the `codex:codex-rescue` subagent; its own live-Postgres smoke test was blocked by its sandbox's
`EPERM` on the DB socket, but it exercised `validate.ts`/`auth.ts` directly and found 2 real gaps:

- `sessionId` accepted arbitrary free text (up to 128 chars) instead of the UUID shape Claude Code
  actually emits — a privacy-invariant gap (spec §6: only hashes/enums/timestamps/numbers, and this
  was an unconstrained string reaching the DB as a primary key). Fixed: `isUuid()` regex check.
- No upper bound on integers — `turns: 2147483648` passed validation but would overflow Postgres
  `Int32` and 500 on the write. Fixed: `isNonNegInt` caps at `INT32_MAX`; `startedMs`/`endedMs` (which
  go into `BigInt` columns but are JS `number` on the wire) now require `Number.isSafeInteger`.
- Minor: `auth.ts`'s `Authorization` header split ignored trailing segments (`Bearer x extra` still
  authenticated). Not a bypass, tightened anyway — now requires exactly 2 space-separated parts.

Auth logic itself held against every real bypass tried (missing/empty/wrong/case-mismatched token).
7/7 `node --test` cases pass after fixes (3 new cases added for the sessionId/int-bound gaps),
typecheck clean.

### User dashboard (numbers-only insights)

User asked for a personal dashboard: prompts/skills used, improvement suggestions. Flagged the
conflict directly — spec §6's privacy invariant forbids free text leaving the machine, so "what did
I prompt" and "read my skills" as literal features were off the table. User picked **numbers-only
insights** from 3 options: counts/trends only, no prompt content read or uploaded, ever.

- `packages/shared/src/schema.ts`: `SessionMetric` gained `toolCounts: Record<string, number>` —
  counts per tool/skill *name* (e.g. `{"Edit": 12, "Bash": 4}`), never arguments or prompt text.
- `packages/shared/src/metrics.ts`: `computeSessionMetric` now tallies every `tool_call` event by
  `tool` name (previously only counted `EDIT_TOOLS` for the rework calc — same loop, added a
  histogram side-tally).
- `packages/shared/src/insights.ts` (new): `improvementTips(metric, cuts)` — pure, threshold-only.
  Compares `reworkRatio` against the season's `p80` cut, turns-vs-edits ratio, and rework count.
  Template strings, no LLM call, no read of prompt content. 4/4 `node --test` cases pass.
- `apps/backend/prisma/schema.prisma`: `toolCounts Json @default("{}")` column, migrated
  (`add_tool_counts`).
- `apps/backend/src/validate.ts`: added `toolCounts` to the schema-walk allow-list with its own
  validator — keys must match a bounded identifier shape (`/^[A-Za-z0-9_.:-]{1,80}$/`, matches real
  tool names like `mcp__plugin_figma_figma__use_figma`), capped at 60 distinct keys, values
  non-negative ints. A free-text key (tested with a prompt-injection-shaped string) is rejected.
- `apps/backend/src/index.ts`: new `GET /api/me/sessions` (bearer-gated) — returns own session
  history with per-session `toolCounts`, an aggregated `toolTotals` histogram across all sessions,
  and per-session `tips` from `improvementTips`.
- Full smoke test against real local Postgres: posted a batch with one valid row (including
  `toolCounts`) and one row carrying a smuggled `promptText` field — the smuggled field was rejected
  while the valid row was accepted and stored; `GET /api/me/sessions` round-tripped `toolCounts`
  correctly into both per-session data and the aggregated histogram, and pre-existing rows from
  before this migration defaulted to `toolCounts: {}` without needing a backfill.
- 10/10 backend `node --test` cases pass (3 new toolCounts cases), 11/11 shared, typecheck clean
  across all 3 packages.
- **Not yet done**: Figma sitemap update (new dashboard page currently sits in the "Deferred"
  cluster — needs moving into the real flow) and the frontend itself (still gated on the UI
  design-system decision).

### Frontend wireframes (design-system gate cleared)

Two decisions the user made, both of which the `CLAUDE.md` gate required before any frontend code:
**low-fidelity greyscale** wireframes, and **Tailwind + shadcn/ui** as the build target (chosen over
hand-rolled Tailwind and over zero-dep CSS Modules — more setup and dep surface, but more polish out
of the box for a judged submission).

Wireframes live in a separate **Figma Design** file, not the FigJam board — FigJam blocks
`FRAME`/`RECTANGLE`/`TEXT` node creation, and the board is deliberately capped at 3 pages:
https://www.figma.com/design/VdPEaCxSvkLqEKibE5qpRE

Four screens at desktop 1440, all content grounded in the real API responses rather than invented:

1. **`/` Home** — tier card, season metric + trend sparkline, qualifying-sessions card, full-width
   distribution with p20/p50/p80/p95 cut markers and a "you" marker, recent-sessions preview.
2. **`/season`** — tier-cuts table, "your position" card with the tier ladder, larger distribution,
   ghosts empty state.
3. **`/insights`** — parsed/qualifying/avg stat cards, tool-usage histogram, the three
   `improvementTips` cards with their numeric trigger conditions, full session table.
4. **`/` empty state** — the `sampleSize = 0` branch from the DFD, with the `kerf sync` prompt and a
   "why a session might not qualify" explainer.

Two details worth carrying into the build: the tier ladder **inverts** for rework ratio
(`higherIsBetter: false`, so a *lower* ratio earns Diamond — `tierForValue` already does this, the UI
must not re-sort it), and non-qualifying rows are shown greyed rather than hidden, so the floor is
visible instead of silently filtering data away.

### Scope expansion (same night): make it a game, in public

User expanded scope after the wireframes landed: SUSE type, a profile section, the shadcn
`sidebar-07` shell instead of top nav, real-time/live preview, YouTube-style live chat, connect your
Claude account, build-in-public projects, and public skill browsing. The project itself is open
source.

The privacy invariant was the only real design problem here — chat and profiles are free text, and
§6 says no free text leaves the machine. Resolved by naming **two ingress paths** rather than
loosening §6:

- **Path A — telemetry** (`POST /api/metrics`, `POST /api/heartbeat`): unchanged. Schema-walked,
  fails closed, hashes/enums/numbers/timestamps only. `Heartbeat` is deliberately the same shape as
  `SessionMetric` minus the finished-session fields, so a live tile shows *that* work is happening
  and *how it is going*, never what it is about.
- **Path B — user-authored content** (profiles, projects, chat): free text permitted because a human
  typed it into a form and chose to publish it. `packages/shared/src/social.ts` caps lengths, strips
  control characters and bidi overrides, and allows only `http(s)` repo URLs (a `javascript:` URL is
  rejected). No code path populates a Path-B column from a transcript.

Backend gained: per-account tokens (raw token shown once, only its sha256 digest stored — auth is a
digest lookup, not a compare against a hardcoded value), `profiles` / `live_sessions` / `projects` /
`chat_messages` tables, and SSE at `GET /api/live/stream` fanned out by an in-process `EventEmitter`
(`src/live.ts`). Public skill browsing is opt-in per profile (`publicSkills`, default off) and shows
tool *names* only — arguments never left the machine to begin with.

Two bugs the work surfaced, both real:

- `session_metrics` was keyed on `sessionId` alone, so any account could upsert over another
  account's row by guessing a UUID. Fixed with a composite `@@id([handle, sessionId])`; the e2e
  script asserts the overwrite attempt no longer lands.
- Chat had no rate limit — one client could flood every SSE subscriber. Fixed with a 5-per-10s
  window per account (429 past that).

Gamification stays display-only per spec §7.2 ("never a total"): badges and streaks are computed
in `packages/shared/src/game.ts` and rendered, but ranking still runs on the ratio alone.

Verified end-to-end against a real local Postgres with `scripts/e2e.mjs` — a 12-step
script that attaches an SSE stream first, then exercises auth, both privacy gates (each rejects a
smuggled free-text field), the cross-account guard, heartbeat → live session → project resolution,
the chat rate limit, public/private skill visibility, and season standings, finishing by asserting
which SSE frames the stream actually observed and that the subscriber detaches on disconnect.
28/28 backend + 33/33 shared + 1/1 cli `node --test` cases pass, typecheck clean across all packages.

### Diagrams and wireframes rebuilt for the new scope

**FigJam board** (3 pages, unchanged count): https://www.figma.com/board/EuViTi5StQyv5uWSiOhO3X

The Backend page was rebuilt from scratch — the previous version had truncated labels
("TypeScript (r…"), overlapping connector text, and connectors routed through nodes. User called it
directly: *"ensure you make the nodes bigger if the text is overflowing and overalying and
cluttered"*. Rebuilt on a fixed 4-lane grid (x = 80 / 500 / 920 / 1440), 360-wide nodes, 15–16px
text, and connectors restricted to BOTTOM→TOP (plus one RIGHT→LEFT for the live lane). The lanes now
carry the architecture's meaning rather than just its parts: orange = Path B, purple = Path A,
green = the SSE live lane, blue = the shared auth/`@kerf/shared` rails. Two residual defects caught
on screenshot review and fixed: the privacy note clipped its last line (resized to 360×300) and the
`publish()` connector label collided with `live.ts` (whole lane moved right to x=1440, section grown
to 1900×1760).

The Main page's HLD nodes were re-texted for the new surface area (CLI now shows both `kerf sync`
and `kerf live`; the API node shows the SSE hub; Postgres lists all five tables) and all six shapes
resized to 340×240 so nothing truncates.

**Wireframes** (Figma Design file, rebuilt from 4 screens to 9):
https://www.figma.com/design/VdPEaCxSvkLqEKibE5qpRE

SUSE + SUSE Mono throughout, shadcn `sidebar-07` shell on every screen (PLATFORM: Home / Live /
Season / Insights; BUILD IN PUBLIC: Projects / Skills / People; footer showing CLI connection state).

1. **`/` Home** — stat cards, tier ladder with the p20/p50/p80/p95 cuts, a "live now" strip, the
   badge row, standings.
2. **`/live`** — six live tiles (turns / edits / rework, pace projection) plus a YouTube-style chat
   rail with its limits stated on-screen (500 chars, 5 per 10s, control chars stripped), and an
   "ended in the last hour" strip.
3. **`/u/[handle]`** — the profile section that was missing: header, stats, the skills-and-tools bar
   list (labelled *"Visible because @ada turned on public skills. Off by default."*), build-in-public
   project cards, and a numbers-only session table.
4. **`/skills`** — league-wide tool usage, and who uses a given skill.
5. **`/projects`** — project cards + the new-project form with its actual field limits.
6. **`/me`** — connect-your-CLI flow (claim handle → copy token, *shown once* → run the two
   commands), visibility switches, and a literal list of what leaves your machine.
7. **`/season`** — tier cuts, distribution histogram, standings.
8. **`/insights`** — session table, tool-use bars, the three template tips with their numeric
   trigger rules shown in mono.
9. **Empty state** — the `sampleSize = 0` branch, with three commands and no fake data.

Every screen states the privacy story on-screen rather than in a footnote ("Names only. Arguments
never leave your machine", "Why this is safe to watch", "What leaves your machine"). All nine
screenshotted and visually verified: no clipped text, no overlap, no dead space. Every handle,
hash and number shown is placeholder or derived from real API response *shapes* — no transcript
content appears anywhere in either Figma file.

### Shared Skills Library + profile links

User asked for people to share the Claude Code Skills they use day to day: browse them, copy them,
install them via a real CLI command, star them, and show them on public profiles. This is Path B
content: a human publishes the skill markdown explicitly. It is not transcript-derived telemetry.

- `packages/shared/src/social.ts`: added `cleanMultilineText()` for skill markdown. It preserves
  newlines/code blocks while still stripping control/bidi characters and enforcing length caps.
  Profile types now include `avatarUrl`, `websiteUrl`, `githubUrl`, `xUrl`; `Skill` type added.
- `apps/backend/prisma/schema.prisma`: added `skills_library` and `skill_stars`, plus avatar/social
  columns on `profiles`. Migration: `20260810023743_skill_library_and_profile_links`.
- `apps/backend/src/validate.ts`: profile URL validation added; `validateSkillInput()` accepts only
  `name`, `description`, and `content`. `handle` comes from the bearer token; `slug` is generated
  server-side.
- `apps/backend/src/index.ts`: added `POST /api/skill-library`, list/detail/by-slug reads,
  star/unstar toggle, and install-count bump. The list endpoint now returns `isStarredByMe` when a
  bearer token is present, so starred state survives reload.
- `apps/cli/src/index.ts`: added `kerf skill install <slug>`, which fetches by slug and writes
  `~/.claude/skills/<slug>/SKILL.md`, then bumps the install counter best-effort.
- `apps/frontend`: `/skills` now has two tabs: existing League Usage and new Shared Library. The
  shared tab supports publish, detail preview, star/unstar, copy content, and copy install command.
  `/me` profile settings gained avatar/social URL fields. `/u/[handle]` shows avatar/social links
  and published skill cards.
- Figma Design file updated with the `/skills` Shared Library tab and `/me` profile-edit state.
  FigJam board remains exactly 3 pages; Backend/Frontend pages include the new skill-library tables,
  routes, and frontend flow.

Verification after the reload-state fix:

- `pnpm -r typecheck` clean.
- `pnpm -r test` clean: 39/39 shared, 33/33 backend, 1/1 CLI.
- `NEXT_PUBLIC_API_URL=http://127.0.0.1:3211 pnpm --filter @kerf/frontend build` clean. Only warning:
  Next could not generate fallback metrics for `SUSE Mono`.
- Local Postgres smoke: publish skill, fetch by slug, star/unstar, run real `kerf skill install`,
  verify exact `SKILL.md` written, verify install counter increments.
- Authenticated list smoke: after starring a skill, `GET /api/skill-library` returns
  `isStarredByMe: true`, fixing the reload-state bug found during review.

### Production deploy verified

Committed and pushed to GitHub:

- `56bb4b2 feat: add shared skills library`
- Repository: https://github.com/Vaibhav91one/kerf

Deployed through `zcli service push`:

- Backend: `zcli service push backend --setup backend --workspace-state clean`
- Frontend: `zcli service push frontend --setup frontend --workspace-state clean`

Live verification:

- Backend health: `https://backend-2cf9-3000.prg1.zerops.app/health` → 200.
- Backend Shared Skills API: `GET /api/skill-library` → 200, returns `{ skills: [...] }`.
- Live end-to-end Path B smoke: created a live profile, published a skill, starred it, verified
  authenticated list returns `isStarredByMe`, bumped install count through the by-slug install route,
  and fetched the public profile.
- Frontend routes verified 200: `/`, `/skills`, `/me`, `/season`, `/live`, `/projects`,
  `/insights`, `/u/live-inr66gpy`.
- Frontend `/skills` deployed build contains the Shared Library UI markers.

Live URLs:

- Frontend: https://frontend-2cf9-3000.prg1.zerops.app
- Backend: https://backend-2cf9-3000.prg1.zerops.app

### Clerk Google auth + CLI login

User rejected the manual token UX and asked for Clerk with Google auth before continuing. Created a
separate Clerk application named **Kerf** (not the pre-existing Clerk apps in the account) and wired
the platform around that app:

```text
kerf login
  → browser opens dashboard connect flow
  → user signs in with Clerk / Google
  → user claims/selects a Kerf handle
  → backend mints a per-account API token
  → CLI stores it locally in ~/.kerf/config.json
  → kerf sync/live use stored auth automatically
```

- `apps/frontend`: added `@clerk/nextjs`, `ClerkProvider`, `/cli/connect`, and Clerk-backed `/me`
  profile connect/update flow. The UI keeps the Material 3/SUSE/sidebar shell.
- `apps/backend`: added `@clerk/express`; `profiles.clerk_user_id`; `api_tokens` table; Clerk-only
  profile upsert; and a 10-minute CLI login handshake:
  `POST /api/cli-login/start`, `GET /api/cli-login/:code`, `POST /api/cli-login/:code/claim`.
  Express Clerk middleware is configured with the same Kerf publishable key used by the frontend;
  otherwise `@clerk/express` fails even when `CLERK_SECRET_KEY` is present.
- `apps/cli`: added `kerf login`, `kerf logout`, `kerf whoami`, local config storage, browser-open
  fallback printing, and config-backed `sync`/`live` auth. Manual `KERF_TOKEN` still works as an
  override for dev/compatibility.
- Zerops project env now has the Kerf Clerk app keys as project-level variables. Backend runtime
  receives the Clerk secret; frontend build/runtime receives only the public publishable key.

Local verification before deploy:

- `pnpm -r typecheck` clean.
- `pnpm -r test` clean: 39/39 shared, 33/33 backend, 1/1 CLI.
- Production frontend build with Clerk env clean; only warning is the existing SUSE Mono fallback
  metrics warning.
- Local Clerk smoke: `/api/cli-login/start` returns pending; unauthenticated claim returns 401
  `not signed in` (proves Clerk middleware is configured) instead of 503/500.

### Public-first Clerk/RBAC fix

User clarified that visitors must land on Home first, explore the platform publicly, then sign in
only when they choose to claim/publish/sync. The previous frontend `src/proxy.ts` installed Clerk
server middleware over frontend routes, which was unnecessary for the client-side Clerk modal flow
and had already produced production handshake failures when the frontend tried to verify Clerk
server tokens.

Changes:

- Deleted `apps/frontend/src/proxy.ts`. Frontend now has **no Proxy/Middleware entry** after a clean
  `rm -rf apps/frontend/.next && next build`; public pages are not gated by Clerk server middleware.
- Removed `CLERK_SECRET_KEY` from the frontend Zerops service. Frontend needs only the public
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; the backend remains the only service with the Clerk secret.
- Backend RBAC is explicit in route names/comments:
  - public read: health, season, live sessions/stream, profiles, projects, skill library, skills
    leaderboard, chat history, CLI login start/poll.
  - public telemetry mutation: skill install-count bump only (aggregate public counter).
  - Clerk session: browser account lifecycle + CLI login claim.
  - member: telemetry upload, heartbeat, chat post, profile update, project/skill publish/star, own
    sessions. Ownership always comes from Clerk/API token, never request body fields.
- Removed unused `POST /api/clerk/api-token` and the matching frontend API client method so CLI
  tokens are issued through one path: `kerf login`.
- Home empty state now shows the current flow: `kerf login`, `kerf sync`, `kerf live`, plus public
  exploration/sign-in CTAs.

Verification:

- `pnpm -r typecheck` clean.
- `pnpm -r test` clean: 39/39 shared, 33/33 backend, 1/1 CLI.
- Clean production frontend build with only public Clerk env clean; only warning is the existing
  SUSE Mono fallback-metrics warning.
- Live backend pre-deploy smoke still healthy: `/health` 200, `/api/season/current` 200,
  `POST /api/cli-login/start` 201.

Post-deploy verification:

- Committed and pushed: `761ebad fix: make Clerk auth public-first`.
- Redeployed backend and frontend through Zerops; `postgresql`, `backend`, and `frontend` all report
  `ACTIVE`.
- Live frontend routes verified 200: `/`, `/me`, `/season`, `/skills`, `/projects`, `/live`,
  `/insights`, `/cli/connect`.
- Live backend verified: `/health` 200; `POST /api/cli-login/start` returns a code.
- Chrome DevTools verified fresh `/` page loads the public Home state with `kerf login`, `kerf sync`,
  `kerf live`, plus "Sign in when ready" and "Explore live feed" CTAs.
- Chrome DevTools verified fresh `/me` page loads inside the app shell and shows "Sign in with
  Google" / "Continue with Google"; no server-side Clerk handshake error.
- Real `KERF_CONFIG=/tmp/kerf-login-prod-test.json node apps/cli/src/index.ts login` verified the
  CLI handoff opens `/cli/connect?code=...`; the live connect page shows "Connect Kerf CLI" and
  "Continue with Google". Full completion requires the user to finish Google auth interactively.

Known follow-up: current Clerk keys are development/test keys, so Clerk logs a browser warning about
development keys on production URLs. Functionality is live, but a production hardening pass should
switch the separate Kerf Clerk app to production keys/custom production settings.

### People/profile + dark default + CLI Dialog polish

User clarified three UI/auth details:

- `/people` is the reusable public user surface; individual profiles now live at `/people/[handle]`.
  The old `/u/[handle]` route redirects there for compatibility.
- Dark mode is the default; light mode is optional through the sidebar toggle (`kerf.theme` in
  localStorage).
- `kerf login` browser authorization uses a shadcn Dialog and redirects the browser to `/me?cli=connected`
  after success; the terminal prints `logged in as @handle`.

RBAC follow-up from review:

- No frontend Clerk proxy/middleware exists in this checkout; public exploration pages remain public.
- Removed the remaining unauthenticated mutation exception: the skill-library install-count bump is now
  member-gated. `kerf skill install <slug>` still reads public skill content, writes `SKILL.md`, and
  best-effort bumps the counter only when the CLI is logged in.

Local verification:

- Real Clerk session against local backend with the real Clerk secret: `/api/clerk/me` returned the
  linked `@vaibhavtomar3003` profile.
- `kerf login` local flow verified end-to-end: CLI opened `/cli/connect`, shadcn Dialog showed
  "Authorize this CLI?", browser redirected to `/me?cli=connected`, and the CLI printed
  `logged in as @vaibhavtomar3003`.
- `kerf skill install` verified with a logged-in local config: wrote `~/.claude/skills/<slug>/SKILL.md`
  and bumped installCount; the exact test skill directory was removed afterward.
- `pnpm -r typecheck`, `pnpm -r test`, and `pnpm --filter @kerf/frontend build` pass. The only build
  warning remains the existing SUSE Mono fallback-metrics warning.
## 2026-08-10 — design-to-code (branch `design-to-code`)

Ported the `Material 3 — Platform` comps (Figma page `105:2`, 18 boards) to code. Light and dark are
one component set: the Figma variable collection (Light `98:1` / Dark `98:2`) is mapped onto
shadcn's token names, so `ui/*` primitives inherit the palette instead of carrying a second one.

Screens: Home `129:2`, Empty `131:442`, Live `130:2`, Profile `130:181`, Season `131:122`,
Insights `131:287`, Skills `130:346`, Projects `130:510`, Me `131:2`, plus a plain `/people` index
(the board draws the profile screen as the People destination and no directory).

Assets: 10 icons, 5 league crests, 5 badge medallions, 13 avatars, 5 illustrations, exported from
their masters. Figma bakes the page canvas into a component export, so each file is reduced to its
own `Kerf/Asset/*` subtree — otherwise every crest carries an opaque light rectangle that reads as a
grey square in dark mode. Icons are inlined as components taking `currentColor` per the Figma note
on each master; multi-colour artwork is served as files and never recoloured.

Theme: class on `<html>`, pre-paint script in `<head>`, toggle in the sidebar footer. Neither board
draws a switcher, so it sits where it disturbs them least.

Verified in a browser against both boards at 1440: sidebar 260, nav rows 34px on a 34px pitch,
h1 28px at y42, stat cards 260x116 at y151. `pnpm -r typecheck` clean; `pnpm -r test` 40 shared /
33 backend / 1 cli; production frontend build clean (only the pre-existing SUSE Mono fallback
warning). Screens were diffed against the comps with a throwaway fixture API carrying the comps'
own numbers — that server lives in the session scratchpad and is not part of the repo.

See CLAUDE.md "Where the comps and the API disagree" for the five places the boards ask for
something the backend does not serve, and what was done about each.

### Merged and deployed (design-to-code → master)

`design-to-code` merged master in first (twelve conflicting files, two independent
implementations of the profile screen, People, the theme toggle and CLI connect),
resolved deliberately: master's route shape and dialog flow, this branch's
rendering of the screens the comps define, master's theme toggle reading the
pre-paint script rather than re-deciding. Master then fast-forwarded to it.

Deployed through `zcli service push` with explicit ids, since the interactive
service picker is unavailable in a non-tty:

- `zcli service push backend  --project-id pIP9uHTARtKgxAqQWZAzIQ --service-id M23Im0RVRsOY0nR2vD0vOQ --setup backend  --workspace-state clean`
- `zcli service push frontend --project-id pIP9uHTARtKgxAqQWZAzIQ --service-id 057LBx5uRRAqH5PapuvnzQ --setup frontend --workspace-state clean`

Live verification:

- `/health` 200, `/api/season/current` 200 and now carrying `histogram`.
- Frontend routes 200: `/`, `/live`, `/season`, `/insights`, `/projects`,
  `/skills`, `/me`, `/people`, `/people/[handle]`; `/u/[handle]` 307s to
  `/people/[handle]`.
- Home renders the empty-season comp (131:442) against the real, empty prod
  season — illustration, the four stat tiles, the three-commands panel, the
  nobody-is-live skeletons and the "why it is empty and not fake" note.

Two things prod still needs, neither of which can be done from a non-interactive
shell:

- **Real data.** `kerf login` needs a browser Google sign-in; after that
  `kerf sync` fills the league. Until then the season is honestly empty.
- **The smoke rows** (`me`, `live-inr66gpy` and its published skill) need direct
  Postgres access. `zcli vpn up` wants wireguard's `wg-quick` plus sudo, so this
  is a GUI console or a local `wg` install away. Note `me` is re-seeded at boot
  whenever `KERF_TOKEN` is set, so clearing it means clearing that secret too.

### Production Clerk secret does not match the frontend's instance

Found while trying to claim a handle on the live dashboard. The claim failed
with `not signed in`, and the cause is not the session:

- `window.Clerk.session` is active until 2026-08-17 and `getToken()` returns a
  valid JWT.
- That token's `iss` is `https://skilled-jaguar-59.clerk.accounts.dev`, which is
  exactly the instance the deployed publishable key
  (`pk_test_c2tpbGxlZC1qYWd1YXItNTku…`) points at, so frontend and publishable
  key agree.
- Posting that token to `GET /api/clerk/me` still returns 401 `not signed in`,
  which is `clerkMiddleware` failing to verify a well-formed token from the
  right issuer. That only happens when `CLERK_SECRET_KEY` belongs to a
  different Clerk application.

Consequence: every Clerk-authenticated route is unreachable in production —
claiming a handle, `POST /api/clerk/profile`, and the `kerf login` claim step.
`kerf login` will start and then never complete. The earlier "Clerk mode
smoke-tested" note only ever proved the secret was *present* (an unauthenticated
call returning 401 rather than 503); it never proved the key pair matched.

Fix: copy the secret key for the `skilled-jaguar-59` instance from the Clerk
dashboard into the project's `CLERK_SECRET_KEY`, then redeploy the backend.
`/api/clerk/me` with a live session token should answer 200 instead of 401.

Separately: deploying master's zerops.yml had removed `CLERK_SECRET_KEY` from
the backend run environment entirely, which took the same routes to 503
"clerk not configured". The project-environment reference is restored in
79f7f06; if service-scoped secrets are still the goal, wire the secret onto the
backend service first and drop the line again afterwards.

## 2026-08-11 — points, levels, and the readability rework

The season ranked on rework ratio: a decimal printed on nine surfaces, with tiers cut at live
percentiles. A visitor read `0.369` and `p20 cut is 0.31` and learned nothing from either. The
user's verdict was blunt — "those are not readable things… people will not understand the ratios" —
so the score changed and every surface that carried a ratio was rebuilt.

### The scoring model (`packages/shared/src/points.ts`, new)

Pure, no I/O, derived on read from columns already in `session_metrics`. No metrics migration, no
CLI payload change, and `validate.ts`'s Path-A allow-list is untouched — points never travel the
wire, they are computed server-side from what is already stored.

- `sessionPoints()` — **landed** (`10·log2(1 + edits − rework)`, sublinear so a 200-edit session
  cannot bury a careful 20-edit one), **precision** (`30·(1 − reworkRatio)`, the dominant term —
  the old metric kept as the engine and hidden from the UI), **focus** (`20·min(1, landed/turns/3)`,
  so one enormous Write hits a ceiling instead of running away).
- `totalPoints()` sums per UTC day clamped to `DAILY_POINT_CAP`; `monthPoints()` restricts to the
  current UTC month. `rankFor()` maps a total onto five fixed `LEVELS`.
- `season.ts` lost `tierCuts`, `TierCuts`, `tierForValue`, `seasonScore` and `percentile`; only
  `type Tier` survives. Deleting them is what forced every ratio out of the UI — nothing can print
  a cut that no longer exists. `game.ts` lost `tierProgress()` and its `cuts` argument; badge ids
  are unchanged, so `public/kerf/badge/*.svg` still maps.

This **deviates from spec §7.2, which forbids ranking on a total**, and `game.ts`'s banner used to
say exactly that. It ships with the §7.5 degenerate-play counters that make it defensible: a
non-qualifying session scores 0, each UTC day is capped, and the award is sublinear in volume and
dominated by precision. Both banners now carry the deviation rather than contradicting it silently.

Sanity gate on the real corpus before any UI was built on it: 25 sessions, 9 qualifying, 532
lifetime points → Silver, 2% toward Gold. Plausible, so `LEVELS` was left alone — it is a tuning
knob marked `ponytail:`, one edit from a re-fit once there is real data.

### Backend

`/api/season/current` now returns `{ metric: 'points', levels, standings }` ordered on points earned
this month, with each player's lifetime level as their crest; the histogram, the cuts, the ghosts row
and `higherIsBetter` are gone. `/api/profiles/:handle` serves a points standing. `/api/me/sessions`
gained per-session `points`, plus `totalPoints`, `monthPoints`, `rank`, and `hasCliToken` — the last
is what lets `/me` hide the connect steps once a token exists.

New: `projects.logo_url` (migration `20260811023233_add_project_logo`), validated with the existing
`cleanRepoUrl()` http(s)-only allow-list rather than a second URL check. `DELETE /api/projects/:id`
and `DELETE /api/skill-library/:id` scope by handle **in the WHERE clause**, so a delete that matches
nothing is a 404 — verified in `scripts/e2e.mjs`: another account's delete returns 404 and the row
survives; the owner's returns 200 and it is gone.

### Frontend

Five hand-rolled date helpers collapsed into `lib/time.ts` (two of them were printing raw ISO
stamps). Two near-identical live tiles became `live-card.tsx`, two identical session tables became
`session-table.tsx`, and `/me` and `/people/[handle]` — which shared nothing — became one
`profile-view.tsx`. The home page's four stat cards and the whole tier-ladder panel became one
`rank-progress.tsx`: crest, points, bar, next crest.

New: a 56px sticky `top-bar.tsx` (breadcrumb, streak chip, account menu) mounted in the `(app)`
layout; badges moved into the profile hero; project cards show a logo or the new
`project-fallback.svg`, with a GitHub mark in place of a printed URL; the projects form moved into a
dialog; `/season` prints level thresholds instead of percentiles; Insights uses the shared table and
says plainly that AI-powered tips are not built yet.

Five new illustrations in the existing flat 320×240 idiom: four activity variants keyed off a live
session's counters (building / debugging / reading / exploring) and the project fallback.

### CLI

`kerf skills` and `kerf projects` list what is on this machine and make **no network call** —
verified with the backend stopped. `kerf skills publish <slug>` and `kerf projects publish
[--name] [--repo]` are the only new commands that transmit, and only what you named. Project publish
sends `sha256(cwd)`, which is what links your uploaded sessions to the project — something the web
form cannot supply. Project listing recovers each `cwd` from the transcript's own first record, not
from the directory name, whose path encoding is lossy (§5.1).

### Onboarding

`/cli/connect` moved inside the `(app)` group: the dashboard renders behind it, blurred, and the flow
is a three-step dialog — Google, your profile (avatar prefilled from Google, editable), then a
plain-language panel saying what leaves the machine and what never does, read *before* the token is
minted. The CLI handshake is byte-for-byte unchanged: same URL, same `?code`, same polling, same
one-shot claim. Only the presentation moved.

### Verification

`pnpm -r typecheck` clean across all four packages. Tests: 44 shared / 34 backend / 1 cli.
Production `next build` passes with every route intact. `scripts/e2e.mjs` passes against a real
Postgres (use a throwaway `kerf_e2e` database — it expects an empty one). Browser walk of `/` and
`/people/[handle]` in both themes shows no decimal ratio, percentile or `pXX` label anywhere; the
purge grep over `apps/frontend/src` returns only comments and the `/me` privacy field list.

Still open: the Figma files (wireframes, Material 3 comps, FigJam) still describe the ratio model
and have not been updated.

## 2026-08-11 (later) — readability pass, real skill names, and a privacy page

Reviewing the points rework in a browser produced a list of concrete problems. All of them are code
now; the Figma files are still to follow.

### Real skill names on /skills

`/skills` was listing `Bash 1040`, `Read 341`, `Edit 250` — facts about Claude Code, not about
anyone's craft. The interesting unit is the skill.

Checked against the real corpus: assistant records carry a top-level `attributionSkill` — 1039
records, 16 distinct slugs, every one already matching the backend's `TOOL_NAME` regex. It also
catches skills entered by slash command, which never produce a `Skill` tool_use at all (there were
only 18 of those). `extract.ts` now emits one `skill:<slug>` key per attributed record **that
produced a tool call** — per record, not per block, because a "use" is a turn the skill drove.
`metrics.ts` and `schema.ts` needed no change; `toolCounts` already folds `e.tool`.

**Only the slug is read.** A `Skill` block's `input.args` and a transcript's `<command-args>` are
free text and are never touched. The extractor guards the slug with a local copy of `TOOL_NAME` so
one malformed value can't fail the whole session closed at the validator.

`MAX_TOOL_COUNT_KEYS` went 60 → 240. A real session already carries ~52 distinct tool names, and
this validator fails closed on the entire metric — a cap that tight silently loses sessions, which
is the opposite of what it is for. The privacy bound was never the count; it is `TOOL_NAME` plus
fail-closed on unknown keys. `kerf sync` now prints rejection *reasons*, not just a count.

`GET /api/skills` classifies each key into `skill` / `mcp` / `builtin` (`classifyTool`), folding an
MCP server's tools into one row. Server-side, because the client only receives the top-7 users per
row — folding after that slice would report a wrong `users` count. All three kinds are still
returned; the page filters `builtin`, so restoring tools is one line.

Verified end to end: 25 sessions re-synced, 0 rejected, max 40 distinct keys in one session, and
`/skills` now reads `grill-me 176`, `figma:figma-use 153`, `claude-in-chrome (MCP) 773`.

### Type scale, +15%

Body text was 13px in 190 hardcoded `text-[Npx]` literals. One-shot codemod against an agreed table
(13→15, 11→13, 28→32, …), verified by multiset rather than by re-running — the mapping is not
idempotent. The vendored `components/ui/*` primitives size with Tailwind tokens instead, so
`--text-xs…--text-xl` were overridden by the same 15% in `globals.css`; that single block also
covers `shared-library.tsx` and the connect dialog, and keeps the two scales from drifting.

Seven fixed-height panels became `min-h-` (they clip at the new size), two fixed-width buttons became
`min-w- + px-`, and four skeleton placeholders were re-tuned so the page stops jumping on load.

### Chrome

The collapsed sidebar was broken: `SidebarHeader className="p-0"` removed the 8px gutter that makes
`8 + 32 + 8 = 48px` centre a mark in the icon rail, and the raw `<KerfLogo>` was being shrunk to
16px by the primitive's `[&_svg]:size-4`, leaving a clipped sliver of the title text. Header padding
is scoped to the expanded state, the mark has its own box, the title hides in icon mode, and the
footer no longer overflows 48px.

The top bar gained the `SidebarTrigger` (previously exported but unused — Cmd+B and the invisible
rail were the only ways to collapse), the theme toggle (moved out of the sidebar footer), a real
Sign in **button** via Clerk's modal, and a slot for per-page actions.

Per-page actions use `createPortal` into that slot (`top-bar-actions.tsx`) with
`useSyncExternalStore` — chosen over a context provider because registering JSX re-registers every
render, and over the top bar owning the dialogs because it would then need both pages' data. The
`useSyncExternalStore` shape also avoids adding a third `set-state-in-effect` lint site. "New
project" and "Publish a skill" now live in the bar and are **never disabled**: signed out they open
sign-in, which is what someone clicking them actually wants.

`/me` renders conditionally rather than with a `hidden` class, lost the ROTATE TOKEN panel, and its
command blocks became a shared `CommandBlock` with per-line copy buttons (the one existing
`CopyButton` was lifted out of `shared-library.tsx` into the kerf UI kit, gaining an unmount timer
clear and a rejection catch on the way).

Project cards are two-column now — text left, art filling a full-height panel on the right — instead
of a 240px box with four absolutely-positioned children. The fallback illustration's viewBox was
cropped to its own artwork so it fills that panel instead of floating in padding.

`/people` gained a search box. The handle is the unique tag, so one field does both jobs: type a name
to filter, type an exact `@handle` and press Enter to go there. Client-side over the existing list —
the route is unpaginated at 200 rows and there are single digits of profiles.

### Prose out, /privacy in

Roughly twenty explanatory sentences were scattered across the screens, five of them restating the
same privacy point in near-identical words. All removed; `/privacy` is their single home, assembled
from the same sentences with no new claims. One exception stays inline: the caption under the
`publicSkills` switch on `/me` — a consent control has to state its consequence at the point of the
click.

### Verification

`pnpm -r typecheck` clean ×4. Tests 44 shared / 37 backend / 1 cli. Production build passes with
`/privacy` present. `scripts/e2e.mjs` passes against real Postgres including the new MCP folding and
the owner-scoped unpublish guard. Browser-checked at 1440 in both themes: skills list, projects
cards, collapsed sidebar, `/me` copy buttons, `/privacy`, and the top-bar theme toggle.

### Follow-ups the same day — chrome removed, then verified through the UI

The top bar was tried and cut. The rail is the only chrome now: the collapse arrow sits beside the
logo (and is the sole survivor when collapsed), page actions moved onto each `PageHeader` row via an
`action` prop, and the theme toggle moved to `/me`. `top-bar.tsx` and the `TopBarActions` portal were
deleted with it — the portal existed only to feed a bar that no longer exists. `PageHeader` also lost
its hairline rule. Project cards went to two-per-row with the art panel's tint removed, and the
fallback illustration's viewBox was cropped so it fills that panel.

Four real defects the dev log and a UI pass turned up, all fixed rather than silenced:

- **`<li>` inside `<li>`** — the old top bar nested `BreadcrumbSeparator` (an `<li>`) inside
  `BreadcrumbItem`. Gone with the bar.
- **Base UI `nativeButton` warnings** — `<Button render={<Link/>}>` swaps the native `<button>` for
  an anchor; those call sites now pass `nativeButton={false}`.
- **SUSE Mono font warning on every compile** — next/font has no metric overrides for that family,
  so it could never synthesise a fallback. Fixed by declaring the mono stack and
  `adjustFontFallback: false`, not by hiding the warning.
- **`<script>` rendered by a component** — the pre-paint theme script is now `next/script` with
  `strategy="beforeInteractive"`.

And three found by actually clicking through it:

- **"New project" did nothing.** `DialogTrigger render={<NewProjectButton/>}` passes the trigger's
  onClick/aria through props, and the component was swallowing them. It forwards props now.
- **`hasCliToken` was false for a connected account** — it counted only `api_tokens`, so an account
  connected by the legacy dashboard token was shown "connect in three steps" beside a CLI STATUS
  card reading Connected. It now counts either.
- **A public profile listed every raw tool key** — a wall of Bash/Read/Edit/Write. It uses the same
  `classifyTool` taxonomy as `/skills`: skills and MCP servers, folded per server.

Verified in the browser signed in: create a project through the dialog (persisted), publish a skill
through the sheet (persisted), star a skill (0→1), unpublish (persisted, list shrank), people search
by name and Enter-on-@handle navigation, both themes, collapsed and expanded rail. Console clean on
every route, dev log clean, `next build` reports zero warnings and zero errors, and `scripts/e2e.mjs`
passes on a fresh database.

## 2026-08-11 (later still) — Home stops being the board

Home and `/season` had become the same page: `/season` fetched exactly one endpoint, Home already
fetched it, their standings tables were ~90% identical markup, and Home's `<h1>` read `Season {n}`.

**The split, which should hold.** `/season` owns the board — levels, how points are earned,
standings, and now the full badge ladder. Home owns you and the room — CLI/sign-in state, your rank,
your badges, the single next badge to chase, skill of the day, trending this week, live now. Home's
standings table, its "You are #N" line (moved to `/season`) and MOST STARRED SKILLS (trending
replaces it) are gone. `seasonNumber()` moved to `lib/time.ts` now that `/season` is its only caller.

### Badges learned to count

`game.ts` was computing `elite` and `streak`, comparing them, and throwing the numbers away — so
nothing could say "2 of 5". `Badge` now carries `progress: {have, need}` and a `requirement` line.
Two of the six are not natural counters and say so: `clean-run` reports the *best partial attempt*
(your cleanest session's edit count, 0 for any session that re-touched a file) and `steady-hand` the
*current leading run* — both monotone and predictive, where a "4 of your last 5" sticks at 4 forever
while the bad session sits in the middle. Both preserve their original boolean exactly, and a test
sweeps `earned === (have >= need)` over a mixed corpus.

Root cause fixed while in there: `badges()` trusted caller ordering for `slice(0, 5)`, and the
leading-run semantics made that load-bearing. It sorts its own copy now — one line at the point every
caller routes through, plus a test that locks it.

`nextBadge()` picks the unearned badge closest to done; strict `>` keeps declaration order on a tie,
so it is stable across renders. Home shows that one; `/season` shows all six.

### Trending and skill of the day

`GET /api/skills?window=7d` — one `where` clause landing on the existing `@@index([handle, startedMs])`,
no migration, and it *shrinks* the JS fold so it is cheaper than the unwindowed call. Skill of the day
is `floor(Date.now() / 86_400_000) % pool.length` over the top 20: the UTC day number is already
uniform, so it is its own hash — no crypto, no stored pick, no cron, and every instance answers the
same thing.

That only works if the list is totally ordered, and it was not: equal counts fell back to Postgres
row order, so the list could reshuffle on a restart. Now `b.count - a.count || a.name.localeCompare(a.name)`.

### GitHub, without becoming an SSRF gadget

New `/projects/[id]` page and a `GET /api/projects/:id/github` proxy. `cleanRepoUrl` allows any
http(s) host — correctly, since it guards what we render as a *link* — so feeding a stored `repoUrl`
to a server-side fetch would let an owner point us at `169.254.169.254` and read the response back.
`githubRepo()` is the guard: https only, `hostname === 'github.com'` compared **exactly** (both
`evilgithub.com` and `github.com.attacker.tld` pass an `endsWith` test), and the outbound URL is
rebuilt from `owner`/`repo` rather than the stored string. Verified end to end: four hostile URLs each
404 at the parser, the real one returns 200.

The response is a whitelist, not a passthrough — GitHub's repo object is ~100 keys — and its strings
run through the Path-B sanitisers because they are free text from outside our trust boundary. **It is
never written to a `Project` column**; that would be a Path-B write from a non-human source. Failures
are cached alongside successes, or an uncached 404 burns the anonymous 60/hr budget on every view.

### Empty states, carousel, and /me

One `EmptyState` (centred illustration, then the line) adopted at 6 of ~19 sites. The other 13 keep
their plain `<p>` for reasons kept in comments: two are `<td colSpan>` inside a `table-fixed` body,
one is an inline `<span>` in a chip row, several sit in `overflow-y-auto` rails where the art would be
the first thing to scroll away, one re-renders per keystroke, and `profile-view`'s "Nothing shared" is
a *privacy* state rather than an absence — an illustration there would make the wrong claim, so its
copy changed instead. The three illustrations this used (`publish-project`, `insights`,
`live-activity`) had been sitting on disk, in the union, referenced nowhere.

`BadgeCarousel` is native CSS scroll-snap plus two arrows, ~60 lines, no dependency — this project is
on `@base-ui`, so `shadcn add carousel` would have dragged in embla and a second primitive stack to
slide six chips. The `<ul>` is one tab stop the browser already scrolls with arrows/Home/End, and
overflowed chips stay in the DOM so a screen reader reaches all of them.

Your own profile no longer shows the dead Follow button — that slot is the carousel. Visitors still
see Follow, inert, as the comps draw it. The tool-use rail lost `sticky`. `/me` is reordered (profile
→ rank → CLI status → published lists → four `ActionCard`s → connect steps) and the visibility rows
became cards: one real `Switch` for skills, and actions for the three that were never preferences.

### Verification

typecheck ×4 clean; 59 shared / 37 backend / 1 cli; `next build` 0 warnings 0 errors with
`/projects/[id]` listed; `scripts/e2e.mjs` green on a fresh database. In the browser: Home shows rank,
badges, "2 of 3" next badge, skill of the day, trending and live with no standings table; `/season`
shows standing, the six-badge ladder with progress, levels and standings; `/projects/[id]` renders
live GitHub data ("pushed 21h ago", TypeScript).

### Review pass findings

Three things the review caught that testing had not:

- **The badge rail would have overlapped the name.** `profile-view`'s hero put the right slot at
  `absolute right-[22px] top-[32px]` — safe for the 128px Follow button it used to hold, not for a
  420px carousel. The hero is a flex row now, identity `min-w-0 flex-1`, rail `shrink-0`.
- **`empty-season.tsx` became unreachable** when Home stopped short-circuiting on
  `sampleSize === 0`. Deleted. Its only dependant, `StatCard`, is kept — it is a comp shape
  `PageSkeleton` still mirrors — but now says in a comment that it has no caller, rather than
  looking live.
- **`nextBadge` verified against the real corpus**, not just fixtures: it picks `clean-run` (2/3)
  over `streak-7` (3/7), the `earned === have >= need` invariant holds on every badge, no `have`
  exceeds its `need`, and shuffling the input changes nothing.

Console is clean across all ten routes. The two "preloaded but not used" warnings are Next's own
single preload link, identical on every page and unrelated to these changes.

### Sidebar: collapse removed

The icon rail was a worse version of the same navigation — unlabelled glyphs, a "Toggle Sidebar"
tooltip that stuck open over the nav, and a footer that overflowed the 48px width. It is
`collapsible="none"` now, plus `sticky top-0 h-svh` because that mode renders a plain flex child that
would otherwise scroll away with the page.

Gone with it: `SidebarTrigger`, `SidebarRail`, the per-row tooltips (they only ever showed while
collapsed) and the last `group-data-[collapsible=icon]` class, which was still sitting in
`cli-status.tsx`. The expanded rail got the attention instead — 40px rows on a 2px pitch with an
18px glyph, a hover state it never had, 26px between groups, and a footer that no longer fights a
hairline inset. `/projects/[id]` now keeps Projects lit, which it did not before.

Trade worth naming: `collapsible="none"` also drops shadcn's mobile sheet, so the rail always takes
its 260px. Every screen in this app is a fixed two-column desktop grid, so that is the honest shape
rather than a responsive promise nothing else keeps.

## 2026-08-11 (evening) — artwork that scales, a project page worth visiting, and `kerf` on PATH

### The badge scaling bug, root-caused

Reported as "somewhere it is small, somewhere it is ok, somewhere it is perfect". Measured: every
badge and crest is a `512×512` canvas, but each was exported with its own whitespace, so the ink
covers anywhere from **27.7%** (`clean-run`) to **87.4%** (`steady-hand`). `BadgeArt`/`LeagueArt` map
`size` onto the canvas, never the drawing — so at `size={22}` in the carousel `clean-run` rendered
**6.6 × 6.1px** of ink beside `steady-hand`'s **19.2 × 4.4px**. Same prop, ~3× apparent width.

Fixed at the source, not the call sites: each of the ten viewBoxes is now **squared on its own
bounding box** plus 7%. Square rather than tight because both components render `width == height`, so
a tight non-square box would letterbox and reintroduce the same problem on the other axis. No path
data changed — the art is byte-identical, only the frame moved. The invariant is written into
`artwork.tsx` so the next asset gets the same treatment.

Also closed the hole I opened last round: `project-fallback.svg` was the only illustration not
`320×240`, which made `Illustration`'s hardcoded 4:3 height wrong for it and reflowed the box on load.

### New project artwork, researched rather than guessed

GitHub's own rationale for rejecting the box metaphor decided this: *"some would say a repository is
storage — a place where you store your code, somewhat like a box… at GitHub repositories are much
more than that. A repository is the history of your project."* The old art was a crate — the exact
motif they abandoned, and it collided with `publish-project.svg`'s server besides.

The replacement is a folder carrying a git graph: a named thing on disk (which is what a Kerf project
literally is) plus the history that distinguishes it from a box. Amber HEAD as the single focal, the
same role amber plays in `insights.svg`. Drawn edge to edge at `320×240`, legible down to the 72px it
renders at on a profile.

Worth recording: **the Figma file has no asset library to reuse.** The `Assets — Kerf` page the specs
describe does not exist, and `search_design_system` returns nothing for project/repo/folder — the
`Kerf/Asset/Illustration/*` group ids in the SVGs are aspirational naming, not exports. All artwork
here is authored locally, and any future Figma work has to create that page *from* these files.

### Skill names

`formatSkillLabel()` in `social.ts`, applied everywhere a skill is displayed. It strips packaging
noise (`plugin_figma_figma` → `figma`, `figma:figma-use` → `figma-use`) but **keeps the result a
slug** — that string is what you type into `kerf skills publish`, so Title Case would make the screen
and the CLI disagree. The profile's ad-hoc `replace(/^skill:/, '')` is gone in favour of it.

Skill of the Day is centred now — name, meta, then a facepile capped at **3** overlapping avatars with
a `+N` chip — and the empty right half holds a new `skill-spotlight.svg`. Trending keeps its bars: its
right half is already full and a second illustration would crowd five rows.

### The project page

The whole card navigates, via a **stretched link** rather than a wrapping anchor — the card already
contains an `<a>` to the repo and a `<Link>` to the owner, and nested anchors are invalid HTML that
browsers silently un-nest. The title's `::after` claims the surface; the inner links sit on `z-10`.
Owner avatar added, GitHub mark moved up beside the name.

`/projects/[id]` gained a hero (avatar, name, description, repo link) and **tabs that only exist for
what the project has** — Overview always, Activity when it has sessions, Repository when GitHub
resolved. An empty project shows one tab, not three dead ones.

Two charts, on Recharts per the user's call, confined to `components/kerf/project-charts.tsx` so the
dependency lands on one route: sessions-per-week from a new `/api/projects/:id/activity`, and a
language pie from GitHub's `/languages`. The activity endpoint returns **counts only** — the comment
next to it says why a week is the floor.

### `kerf` on PATH

`~/.local/bin/kerf`, a two-line wrapper. `npm i -g` fails on `workspace:*` and would copy
`@kerf/shared` into `node_modules`, where Node refuses to strip types — the CLI works only because
pnpm symlinks it and Node resolves the realpath outside `node_modules`. `pnpm link --global` needs
`pnpm setup`, which rewrites `~/.zshrc`. The wrapper touches nothing and hardcodes the repo path,
which is its one limitation.

### Verification

typecheck ×4; 61 shared / 37 backend / 1 cli; `next build` 0 warnings 0 errors.

From the CLI, run as `kerf` from `/tmp`: dry run (26 sessions, 10 qualify), `kerf skills` (92 local,
no network), `kerf projects` (8 local, no network), `kerf sync` (26 uploaded, 0 rejected),
`kerf skills publish`, `kerf projects publish`, `kerf whoami`. `kerf live` correctly reported 0
in-flight sessions — the newest transcript event was 57 minutes old, because this session runs under
a `.claude-work` profile the extractor deliberately excludes; the beat path itself was verified by
posting a heartbeat and watching the tile appear.

From the UI: badges now read as one set at every size; skill names formatted; Skill of the Day centred
with its spotlight; clicking empty card space navigates while the repo and owner links still reach
their own targets; tabs appear per-project; the language pie renders real GitHub data (TypeScript 93%,
JavaScript 5%, CSS 2%, Shell 0%) and the activity area chart draws 12 buckets. Cache still serves the
second GitHub call in 8ms, and the SSRF guard still 404s `evilgithub.com` and `169.254.169.254`.

### Toasts, and a YAML bug the toasts surfaced

`sonner` mounted once in the root layout, bottom-right, firing on star / copy / publish / unpublish /
visibility-toggle — the actions that previously changed a number somewhere and gave no other signal.
The wrapper reads the `dark` class off `<html>` through a MutationObserver instead of next-themes,
which this app does not use and does not need.

Skill of the Day is left-aligned now with the illustration at 46% of the card and both columns
stretched to full height. The illustration briefly went onto the shared-library skill cards too and
was removed again on request.

Publishing a real skill through the CLI to test the toast exposed a parser bug: `listLocalSkills`
read `description:` as a scalar, so a SKILL.md using YAML's folded form (`description: >` with the
text on following indented lines — which `caveman` does) published a description of literally `">"`.
`frontmatter()` now consumes folded and literal blocks (`>`, `|`, `>-`, `|-`).

### Sidebar footer, and the CLI grew a help

The signed-in footer had the handle twice — once in the CliStatus row, once as a button under it. The
button is gone. The status line now reads **In sync** behind a green dot rather than "CLI connected",
because connected describes a socket that does not exist; what matters is whether your sessions are
up here. It reads "Live" while a session is beating, and "Nothing synced yet" before the first sync.

Hovering it explains itself: how many sessions are in sync, and when. That needed a real timestamp,
so `/api/me/sessions` gained `lastSyncedMs` — the newest `createdAt` on a metric row, which is when
`kerf sync` last *wrote*, not when the newest session ran. Those are different facts and the
distinction is in a comment.

`kerf` is a real CLI now. It had no `--help`, no `--version`, and — worse — **an unknown command fell
through to the dry run**, so `kerf frobnicate` printed session statistics and exited 0. There is one
`COMMANDS` table that both `kerf help` and every usage error print from, so they cannot drift; the
help column width is computed rather than hardcoded (the longest usage line ran into its own
description on the first attempt); commands that touch the network are marked, and the ones that do
not are labelled `(local)`. Unknown commands and subcommands now exit 1 with the relevant usage line.

Toasts were reported missing. They were not: the toaster mounts, and a click produces a
`[data-sonner-toast]` with the right text, colours and position, with the document focused — verified
three times. Made them harder to miss anyway: `richColors`, a close button, and 5s instead of 4.

### A confirm dialog, a spinner, and the CLI-status art

Three reusable pieces, because these were about to be written inline for the third time:

- **`ConfirmDialog`** (`components/kerf/confirm-dialog.tsx`) — unpublishing is a delete, and a delete
  that fires on one click with no way back is the kind of thing people only notice afterwards. It
  owns its own pending state: `onConfirm` may return a promise, the button spins while it settles,
  and **the dialog closes only on success**, so a failed delete leaves the error visible instead of
  dismissing as though it worked. It also refuses to close mid-request.
- **`Spinner`** / `LoadingRow` (`components/kerf/spinner.tsx`) — `currentColor`, so it inherits
  whatever it sits in and there is no per-site colour prop to get wrong. Wired into both publish
  forms, the connect dialog's two submit paths, the publicSkills switch, the confirm dialog, and the
  GitHub panel while it waits. That last one also keeps the Repository tab mounted during `loading`
  rather than popping it in after the fetch.
- **CLI STATUS art** — was a 93px `cli-sync` pinned to the corner with `absolute right-[19px]`, which
  looked stranded once that panel went full-width. It is a real 34% column now, same shape as the
  project card.
