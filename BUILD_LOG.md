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
