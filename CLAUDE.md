# Kerf

Competitive league for coding-agent CLI users. Claude Code transcripts are the match record.
**Scoring is points and levels, not the spec's single Tier-A ratio** — see "Points, not a ratio"
below; the rework ratio survives as the engine behind the points, never as a number on screen. Full spec: `~/Documents/app-specs/kerf-spec.md` (authoritative —
read it before changing scoring/privacy/season logic). Design history: `HANDOFF.md`.

Built for the Zerops Challenge hackathon, submission night 2026-08-09. **Tonight's scope is
deliberately narrower than the spec**: Claude Code only (Codex deferred), one scoring model, no
rivals. Multi-account, live feed, chat, public profiles and build-in-public
projects are in — added after the user expanded scope on submission day. The project itself is open
source and built in public.

## Stack

pnpm workspaces, Node 22, TypeScript, raw-TS packages (no build step,
`allowImportingTsExtensions`), `node --test` (not Jest/Vitest), `node:util parseArgs` (not
commander/yargs). Mirrors `~/dev/cornice`'s conventions — that repo is a read-only reference, never
edit it.

- `packages/shared` — types (`schema.ts`), pure scoring logic (`metrics.ts`, `points.ts`,
  `insights.ts`), gamification (`game.ts` — badges/streaks, display-only per §7.2), and the
  Path-B sanitisers (`social.ts` — length caps, control-char/bidi stripping, repo-URL scheme
  allow-list). No I/O.
- `apps/cli` — extractor. Reads `~/.claude/projects` JSONL only (default profile — user has other
  `.claude-*` profile dirs on their machine, deliberately excluded), computes
  `SessionMetric`, and does the same for `~/.codex/sessions` via `extract-codex.ts` (merged into the
  same upload, no flag — see "Follow, Rivals, and Codex" below). `kerf sync` uploads finished
  sessions, then commit counts for §7.4's season floor (`git.ts`, best-effort); `kerf live` beats
  every 15s for in-flight ones (`POST /api/heartbeat`). `kerf login` starts the browser/device flow
  (device code + a short human-typed user code, RFC 8628-style — the old single-secret design was
  phishable), opens the dashboard, and stores the issued API token in `~/.kerf/config.json`;
  `kerf logout` removes it.
  The extractor also reads each assistant record's top-level `attributionSkill` and emits a
  `skill:<slug>` key into `toolCounts` — that is how a real skill name (`caveman`, `grill-me`)
  reaches `/skills`. A `Skill` block's `input.args` and a transcript's `<command-args>` are free
  text and are **never** read; only the slug is.
  Installed on this machine as `~/.local/bin/kerf` — a two-line wrapper that execs `node` on the
  source entry. Not `npm i -g` (rejects `workspace:*`, and a copied `@kerf/shared` lands inside
  `node_modules` where Node refuses to strip types) and not `pnpm link --global` (needs `pnpm setup`,
  which rewrites `~/.zshrc`). The wrapper hardcodes the repo path, so moving the repo breaks it.
  `kerf skills` / `kerf projects` list what is on this machine and make **no network call**;
  `kerf skills publish <slug>` and `kerf projects publish [--name] [--repo]` are the only commands
  that transmit, and only what you named (`src/local.ts`).
- `apps/backend` — Express + Prisma + Postgres. Clerk Google auth owns dashboard identity; CLI/API
  auth uses per-account API tokens minted after Clerk sign-in (raw token shown once, only sha256
  digest stored). Legacy token lookup is left as a compatibility fallback. No `event` table, by
  design (privacy: raw events never leave the user's machine). Tables: `session_metrics`,
  `profiles`, `api_tokens`, `live_sessions`, `projects`, `chat_messages`, `skills_library`,
  `skill_stars`, `follows`, `commit_counts` — no persisted `season` (points and levels computed live
  on read, never stored, never uploaded). Real-time is SSE
  (`GET /api/live/stream`), fanned out by an in-process `EventEmitter` in `src/live.ts`. RBAC is
  route-local in `src/index.ts`: public reads stay public **for public rows**, Clerk session routes
  manage browser account lifecycle, and member routes derive ownership from Clerk/API tokens only.
  `src/visibility.ts`'s `visibleTo(viewer)` is the single narrowing point — every public read of a
  project or a shared skill passes it, with the viewer from `optionalHandle` (which costs no query
  when there is no `Authorization` header). It narrows the **row set**, never the field set: a
  private row is absent, not blanked, so there is no 200-vs-404 existence oracle. The route-guard
  table at the top of `index.ts` carries the three invariants — read it before adding a route.
- `apps/frontend` — Next.js dashboard, built from the `Material 3 — Platform` comps (Figma page
  `105:2`): Tailwind + shadcn/ui on the `sidebar-07` shell, SUSE + SUSE Mono. The Figma variable
  collection is mapped onto shadcn's own token names in `globals.css`, so light and dark are one
  component set and every `ui/*` primitive inherits the palette. Icons live in
  `components/kerf/icons.tsx` (exported path data, `currentColor`); league crests, badges, avatars
  and illustrations are files under `public/kerf/` and are never recoloured. Routes: `/`, `/live`,
  `/people`, `/people/[handle]`, `/skills`, `/projects`, `/projects/[id]`, `/me`, `/season`, `/rivals`,
  `/privacy`. A profile
  lives at `/people/[handle]`; `/u/[handle]` stays as a redirect so links minted before the move
  keep working. `/people/[handle]` and `/projects/[id]` are each a thin server `page.tsx`
  (`generateMetadata` + a fetch for it) wrapping a `*-client.tsx` that does the actual interactive,
  auth-aware rendering — split because `generateMetadata` cannot be exported from a `'use client'`
  file, and every other route here stays a single client component with no metadata of its own.
  `robots.ts`/`sitemap.ts` build on `NEXT_PUBLIC_SITE_URL`. `/privacy` is the single home for the privacy explainers that used to be inlined on
  every screen — product pages link to it instead of restating it, the one exception being the
  caption under the `publicSkills` switch on `/me`, which stays because a consent control must state
  its consequence at the point of the click. `/cli/connect` lives inside the `(app)` group so `kerf login` lands in a dialog over
  the blurred dashboard rather than on a bare page. `/people` itself is the rail's People entry — the board draws the profile screen as
  its destination and no index, so the directory is deliberately plain. Do not invent routes beyond
  these. Public-first: no frontend
  Clerk proxy/middleware; sign-in is needed only for `/me`, CLI connect, and mutating actions.

Run `pnpm install` once at the root. `pnpm -r typecheck` / `pnpm -r test` run across all packages.

Local dev ports: 3000/5432 are occupied by other projects on this machine, 3210/5433 are taken by
cornice. Pick different free ports for local dev servers if any app needs one; Zerops assigns its own
ports in deployment regardless.

## Privacy invariant (spec §6) — do not weaken

§6 governs **transcript-derived** data. Two ingress paths, and the distinction is load-bearing:

- **Path A — telemetry** (`POST /api/metrics`, `POST /api/heartbeat`). Only hashes, enums,
  timestamps, and numbers may leave the user's machine. No free-text strings, ever. `toolCounts`
  keys are the one place a name appears, and `TOOL_NAME` is the bound that keeps a key an identifier
  rather than a sentence — `MAX_TOOL_COUNT_KEYS` (240) bounds payload SIZE, not information type, and
  is deliberately generous because this validator fails closed on the whole metric: too tight a cap
  silently loses sessions. Both routes
  schema-walk every payload in `src/validate.ts` and reject (not store) anything that doesn't match
  `SessionMetric` / `Heartbeat` exactly — silently accepting an unexpected string field is a privacy
  bug, not a validation nicety. Fails closed: unknown key → reject the whole item.
- **Path B — user-authored content** (profiles, projects, chat, shared skills). Free text is
  allowed here *because a human typed it into a form and chose to publish it*. Sanitised in
  `packages/shared/src/social.ts` (length caps, control-char/bidi stripping, `http(s)`-only repo
  URLs; skill content uses `cleanMultilineText`, which preserves newlines instead of collapsing
  them). **No code path may populate a Path-B column from a transcript.** Adding one would be the
  privacy bug §6 exists to prevent.

**Never print real transcript contents back** — not in logs, not in test fixtures, not in a build log
entry, not in a report. Transcripts are the user's own prompt history. Schema/shape inspection is
fine; printing the actual prompt/response text is not.

## Where the comps and the API disagree (decided, not left open)

The `Material 3 — Platform` boards draw a few things the backend does not serve. Each was resolved
toward what is true, and the reasoning lives next to the code:

- **Follow** (profile button, "People I follow" filter). No follow graph exists. On someone else's
  profile the button is rendered as the comps draw it but inert; on **your own** profile it is
  replaced by the badge carousel, since there is nobody there to follow. The "People I follow" filter
  on `/live` is unchanged — present and inert.
- **A visitor's session table** (Profile). `GET /api/profiles/:handle` deliberately serves no
  per-session detail for someone else's account (§6). The table appears on your own profile only;
  a visitor gets a line saying why it is absent.
- **"Cuts unlock at 5 players"** (empty state). Levels are fixed thresholds, so nothing waits for a
  fifth player. The copy is rendered with live counts and the threshold is a display constant.
- **Manual token paste** (Me). That comp predates Clerk. The three steps keep its shape but describe
  `kerf login`, which mints the token and never displays it. Token rotation says what actually
  happens: a new token is issued, the old one is not yet revocable.
- **Live-feed / projects visibility switches** (Me). No longer a deviation — the comps were right and
  the API caught up. Three stored preferences now: `profiles.publicSkills` (the master switch over the
  usage histogram), `profiles.hiddenSkills` (per-`${kind}:${label}` opt-outs), and `isPublic` per
  published project and per shared skill. The live-feed row still explains behaviour rather than
  offering a switch, because a live tile follows its project's visibility and has none of its own.
- **`/skills` shows skills and MCP servers, not tools.** `GET /api/skills` classifies every
  `toolCounts` key (`classifyTool`) into `skill` / `mcp` / `builtin` and still returns all three;
  the page filters `builtin` out, so putting Bash and Edit back is a one-line client change.
  Classification is server-side because the client only receives the top-7 users per row — folding
  an MCP server's tools together after that slice would report a wrong `users` count.

Routes gained fields so a designed element could be real rather than faked: `season/current` returns
`levels` plus per-handle `points`/`monthPoints`/`streak`; `/api/me/sessions` returns `points` per
session plus `totalPoints`, `monthPoints`, `rank` and `hasCliToken` (which is what lets /me hide the
connect steps once a CLI token exists); `/api/skills` returns `topUsers` per tool; `/api/projects`
returns `sessionCount` and `logoUrl`; and `improvementTips()` returns the `title` and the `trigger`
rule that fired it, which is what the Insights comp prints beside each tip. `DELETE /api/projects/:id`
and `DELETE /api/skill-library/:id` are owner-scoped in the WHERE clause — a delete that matches
nothing is a 404, so one account can never unpublish another's row.

## Home is not the board

Home and `/season` used to render the same standings table off the same fetch. They are split now and
must stay split: **`/season` owns the board** (levels, how points are earned, standings, and the full
badge ladder with progress); **Home owns you and the room** (CLI/sign-in state, your rank, your
badges, the single next badge to chase, skill of the day, trending this week, live now). If a
standings table ever appears on Home again, that is the regression.

Badges carry `progress: {have, need}` and a `requirement` line, so an unearned one reads "2 of 3"
instead of just "no". Two are not natural counters and say so in `game.ts`: `clean-run` reports the
best partial attempt, `steady-hand` the current leading run. `nextBadge()` picks the closest to done.

## The GitHub proxy

`GET /api/projects/:id/activity` returns 12 weekly **counts only** — no session ids, no per-session
timestamps. Same class of number as the `sessionCount` already public on that page, just bucketed so
it can be drawn; a week is the coarsest bucket a chart can use, so do not make it finer or add fields.

`GET /api/projects/:id/github` fetches public repo facts for a project's `repoUrl`, including the
per-language byte counts behind the pie (a second upstream call sharing one cache entry). Three rules, all
load-bearing:

- **`githubRepo()` in `social.ts` is the SSRF guard** — https + `hostname === 'github.com'` compared
  exactly, never `endsWith` (`evilgithub.com` and `github.com.attacker.tld` both pass a suffix test).
  Do **not** tighten `cleanRepoUrl` to match: it guards what we render as a *link*, where GitLab and
  Codeberg are legitimate. The outbound URL is rebuilt from `owner`/`repo`, never the stored string.
- **`toRepoJson` is a whitelist**, and its strings go through the Path-B sanitisers because they are
  free text arriving from outside our trust boundary.
- **Its output must never be written to a `Project` column.** That would be a Path-B write from a
  non-human source — exactly what `social.ts`'s banner exists to prevent.

`GITHUB_TOKEN` is optional (60/hr anonymous, 5000/hr with it) and lives in `zerops.yml` under
`run.envVariables`, never `build`.

## Points, not a ratio (the live scoring model)

The season used to rank on rework ratio with percentile tier cuts. A visitor saw `0.369` and `p20 cut
is 0.31` and could read neither, so scoring moved to points and fixed-threshold levels.
`packages/shared/src/points.ts` is the whole model and it is pure:

- `sessionPoints()` — three terms from columns already in `SessionMetric`: **landed** (edits that
  stuck, `log2`-scaled so volume cannot dominate), **precision** (the old ratio, now the engine and
  the dominant term), **focus** (landed per turn, saturating at 3/turn).
- `totalPoints()` sums sessions with each UTC day clamped to `DAILY_POINT_CAP`; `monthPoints()` is
  the same restricted to the current UTC month. `rankFor()` maps a total onto `LEVELS`.
- Points are **derived on read**, server-side. Nothing new is uploaded, `validate.ts`'s Path-A
  allow-list is byte-for-byte unchanged, and there was no metrics migration.
- Level is lifetime and never resets; `/season` ranks on points earned this UTC month.

`LEVELS` thresholds are a tuning knob, not a truth — one edit away, marked `ponytail:`. On the
user's real corpus (25 sessions, 9 qualifying) the lifetime total is 532 → Silver, 2% toward Gold.

**This is a deliberate deviation from spec §7.2 ("never rank on a total")**, taken because the user
asked for leveling. It ships with its §7.5 counters, which are the reason it is defensible: a
non-qualifying session scores 0, each UTC day is capped, and the per-session award is sublinear in
volume and dominated by precision. `game.ts`'s banner carries the same note — do not silently revert
it to "never a total" without also reverting points.ts.

## Follow, Rivals, and Codex — the post-hackathon feature set

Reopened after the hackathon deadline, once the user decided to build Kerf as a real open-source
product rather than a one-night submission.

**Follow + Rivals** are one edge table, not two: `Follow` (`apps/backend/prisma/schema.prisma`) has
`followerHandle`/`followeeHandle` plus an `isRival` boolean, because a rival is by definition someone
you already follow — a separate `Rival` table would need its own FK back to `Follow` just to say so.
Fully public, no visibility flag: `GET /api/profiles` already serves every profile unconditionally, a
follow edge carries zero free text, and `visibleTo()` can't express a two-owner row anyway.
`GET /api/me/follows` is owner-scoped because it's a *control* surface (only you can unfollow through
it), not because the data is secret. `MAX_RIVALS = 3` (`packages/shared/src/social.ts`) matches
kerf-spec.md §8's case for rivals over a global board — a global ladder motivates the top 1% and
nobody else. `/rivals` is a new route; `POST /api/follows/:handle` (toggle) and
`PATCH /api/follows/:handle` (rival flip, capped) are the only new mutating routes.

**Codex CLI gets full parity**, tagged by `source: 'claude-code' | 'codex'`
(`packages/shared/src/schema.ts`'s `AgentSource`, widened from a hardcoded literal — the
`session_metrics.source` column was already a plain `String`, so no migration was needed for this
half). `apps/cli/src/extract-codex.ts` mirrors `extract.ts`'s three-function shape against
`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` — a schema reverse-engineered directly from a real
4,000+ session corpus on the machine this shipped from, since no public documentation exists for it.
Four record kinds matter: `session_meta` (session id + cwd hash — `payload.git` also lives here and is
deliberately never read, §6), `event_msg`/`user_message` (a *positive* human-turn signal, unlike
Claude Code's negative heuristic — but not any record with `role:'user'`, since the harness injects
developer-role preamble that no person typed), `response_item`/`function_call` (tool calls — joins a
`namespace` field onto MCP tool names, e.g. `mcp__chrome_devtools__new_page`, or they'd all misfile as
builtins), and `event_msg`/`patch_apply_end` with `success:true` (the Edit/Write analogue — one event
per path in `payload.changes`). `apps/cli/src/index.ts`'s `readMetrics()` merges both extractors into
one map with no `--source` flag and no id collision risk (the two tools' session ids come from
different UUID schemes). The session table on `/me` shows a small `CC`/`CX` chip per row
(`components/kerf/session-table.tsx`) — a two-letter glyph rather than a real brand mark, since
neither agent has a licensed logo in `artwork.tsx` and inventing one is a design decision, not an
implementation one.

## Artwork invariant

**Every badge and league master's viewBox is squared on its own ink** (bounding box + 7% each side),
not left at the exporter's 512×512 canvas. Illustrations stay `320×240` and bleed to the frame.
Without this, `size` sizes the *canvas* rather than the drawing: the set used to range from 28% to
87% ink coverage, so `clean-run` at `size={22}` drew 6.6px of ink beside `steady-hand`'s 19.2px.
`Illustration()` reserves its box from the 4:3 ratio, so a non-320×240 illustration reflows on load.
Anyone adding art re-crops it the same way.

`formatSkillLabel()` in `social.ts` is the single display formatter for skill/MCP identifiers
(`plugin_figma_figma` → `figma`, `figma:figma-use` → `figma-use`). **The output stays a slug** — it is
what you type into `kerf skills publish`, so prettifying it into Title Case would make the screen and
the CLI disagree.

## Toasts

The CLI has one `COMMANDS` table in `apps/cli/src/index.ts` that `kerf help` and every usage error
both print from — add a command there, not in a second string. An unknown command exits 1; it used to
fall through to the dry run.

`sonner` is mounted once in the root layout (`components/ui/sonner.tsx`) and fires bottom-right for
actions that otherwise change nothing visible: star, copy, publish, unpublish, and the publicSkills
toggle. The wrapper reads the `dark` class off `<html>` via a MutationObserver rather than
next-themes, which this app does not use.

Destructive actions go through `ConfirmDialog` (`components/kerf/confirm-dialog.tsx`), which owns its
pending state and closes only on success. Loading states use the one `Spinner`.

## Charts

`recharts` is a dependency, confined to `components/kerf/project-charts.tsx` so the import cost lands
only on `/projects/[id]`. Everything else in the app stays hand-rolled SVG/CSS bars. Slice colours
come from the illustration palette, axes read theme tokens, so both palettes work with no second
config.

## Chrome

**There is no top bar, and the rail does not collapse.** The 260px sidebar is the only chrome:
logo, nav, then CLI status, a sign-in / @handle button, and the `/privacy` link in the footer. It is
`collapsible="none"` plus `sticky top-0 h-svh` — the icon-only state was a worse version of the same
navigation (unlabelled glyphs, a tooltip that stuck open, a footer overflowing 48px), and every
screen here is a fixed two-column desktop grid anyway. That removes `SidebarTrigger`, `SidebarRail`,
the per-row tooltips (they only ever appeared while collapsed) and every
`group-data-[collapsible=icon]` class. Note the trade: `collapsible="none"` also drops shadcn's
mobile sheet, so the rail always occupies its 260px. Each screen's primary action ("New project",
"Publish a skill") sits on its own `PageHeader` row via the `action` prop, and is **never disabled**
— signed out it opens the Clerk modal. `PageHeader` draws no rule under itself. Theme switching
lives on `/me` only. `/me` renders a sign-in gate (and opens the Clerk dialog) when signed out
rather than showing controls that cannot work.

## Type scale

Screen text is sized with literal `text-[Npx]` / `leading-[Npx]` taken from the comps (~190 of them);
the vendored `components/ui/*` primitives size with Tailwind's `text-xs…xl` tokens. Both were raised
+15% (body 13px → 15px) — the screens by a one-shot codemod, the primitives by overriding
`--text-xs…--text-xl` in `globals.css`'s `@theme inline`. Keeping the token block in step with the px
values is what stops the two scales drifting; change both or neither.

## Lint state

`pnpm --filter @kerf/frontend lint` is **green** (0 errors). It used to be
documented as "red and stays red" while covering only 2 files — that quietly
grew to 10 as new screens added the same pattern, and a red baseline is
exactly what let the growth go unnoticed. `eslint.config.mjs` now scopes
`react-hooks/set-state-in-effect` to `"off"` for the specific files that use it
deliberately (`hooks/use-mobile.ts`, `hooks/use-refresh.ts`, `lib/auth.tsx`,
`components/theme-toggle.tsx`, `components/kerf/cli-status.tsx`, the five
screens that reset-then-fetch on a route param change — `page.tsx`, `me/page.tsx`,
`season/page.tsx`, `people/[handle]/profile-client.tsx`,
`projects/[id]/project-client.tsx` — and
`cli/connect/connect-client.tsx`'s status-reset-before-debounced-lookup) rather
than disabling it repo-wide — a synchronous `setState` in an effect body in any
OTHER file now fails lint for real, which is exactly how this scoping caught
the CLI-connect file honestly needing the same exception rather than silently
joining a blanket-disabled rule. Two errors the rule caught before this
scoping *were* real and are fixed: `Date.now()` read during render in
`cli-status.tsx` and `me/page.tsx`, which is impure and makes hydrated markup
disagree with the server's. The `<img>` warnings in `artwork.tsx` are
deliberate — these are inline SVG assets, and `next/image` buys nothing for
them.

## Known spec deviations (verified against real data, not assumed)

- **`origin.kind` was absent in the hackathon-night corpus and is common now.** Spec §5.4 wants
  `type=="user" && origin.kind=="human"` for human-turn detection; the field didn't exist on real
  transcripts when that was first checked. A later re-check against a fresh corpus found it present
  on most records (values seen: `human`, `task-notification`, `coordinator`), so
  `apps/cli/src/extract.ts`'s `isHumanTurn()` now treats it as the PRIMARY signal and falls back to
  the original heuristic (a `user` record is human unless its `message.content` contains a
  `tool_result` block) only when the field is absent — i.e. older transcripts.
- **Ranking on a cumulative total** — see "Points, not a ratio" above. §7.2 forbids it; the user
  asked for leveling, and the three §7.5 counters ship with it. Still true; not resolved, kept by
  design.

Two more that shipped for the hackathon as deliberately narrower than spec are now resolved:

- **Subagent transcripts are recursed** (`apps/cli/src/extract.ts` walks
  `<session-uuid>/subagents/*.jsonl` alongside the main file; their records share the parent's
  `sessionId`, so they merge with no id remapping). A session that delegated all its edits to a
  subagent used to score near zero — that was the actual bug the original "not recursed tonight" note
  described. `packages/shared/src/metrics.ts`'s `computeSessionMetric` sorts by `ts` then `ordinal`
  (not ordinal alone, since a session can now span more than one file) and guards the human-turn count
  with `isSidechain !== true` so the harness feeding a subagent its next step doesn't inflate `turns`.
- **The real §7.4 season floor is enforced** (10 qualifying sessions AND 5 commits per UTC month,
  `packages/shared/src/season.ts`'s `seasonQualification()`), not just the session-level floor. Commit
  counts come from `apps/cli/src/git.ts`, which recomputes the whole month locally from
  `git log --author=<email> --since --until` per known repo and uploads only the integer — see that
  file's header for why replace-not-increment is what makes re-running `kerf sync` safe, and why §6
  is still honoured (no hash, path, email or message ever leaves the machine).

## Verification state

`packages/shared`, `apps/backend` and `apps/cli` are typechecked and unit-tested (`node --test`):
78 shared / 72 backend / 13 cli cases pass (was 61/37/1 before the production-hardening + feature
pass — `device-code.ts`'s RFC 8628 split, the live-stream per-IP cap, `follows`, subagent recursion,
`extract-codex.ts`, and `season.ts`/`git.ts` each added their own cases). The extractor is verified
end-to-end against the user's REAL, full-size corpus, not a sample: `kerf sync` against
`~/.claude/projects` and `~/.codex/sessions` together uploaded 3,999 sessions (128 Claude Code, 3,878
Codex) with 0 rejected, 69 qualifying, landing the account at Gold / 3,686 lifetime points. Re-run
`node apps/cli/src/index.ts` to refresh. `apps/backend/prisma/migrations/`'s five newest migrations
(`follows`, `commit_counts`, `performance_indexes`, plus the two visibility/logo ones already
tracked) are applied against a real local Postgres, not just written. The backend is verified against
that same database end-to-end (`scripts/e2e.mjs` — needs `scripts/db.sh up`, a booted server, and a
Clerk-unconfigured instance since the script exercises the pre-Clerk `POST /api/profiles` path):
SSE fan-out, per-account token auth, the cross-account overwrite guard, chat rate limiting, both
privacy gates rejecting a smuggled free-text field, and — since the season floor pass — every
standings row correctly carrying `qualified`/`seasonSessions`/`seasonCommits`. Clerk mode is smoke-
tested against the real production Google account this app is meant for: the full device-code
`kerf login` handshake (terminal prints a user code, the already-signed-in browser tab types it,
the CLI collects a token, the token works, and revoking it via `/me`'s CONNECTED DEVICES panel kills
it — `GET /api/me/sessions` with the revoked token then answers `invalid token`), Follow/Rival
toggling round-tripping through a page reload, and the frontend production build has no Proxy/
Middleware entry, includes `/robots.txt` and `/sitemap.xml`, and marks `/people/[handle]` and
`/projects/[id]` dynamic (their `generateMetadata` now fetches per-request — verified live: a real
profile's `<title>` and `og:` tags render correctly). The production frontend is built and deployed
on Zerops; the production auth/scaling items above (`CLERK_AUTHORIZED_PARTIES`, the container pin)
still need the user's own action to actually flip on for the deployed instance.

## Operational readiness

`.github/workflows/ci.yml` runs install → typecheck → test on every push/PR — the commands already
passed locally, this just makes that automatic. The backend handles `SIGTERM` (drains in-flight
requests, closes the DB connection, then exits — Zerops sends this on every deploy) and exits on
`uncaughtException` rather than continuing to serve from a process in an undefined state; both are
in `apps/backend/src/index.ts`, near `app.listen`.

**Backups and rollback are not yet automated — this is a real gap, not a decided deviation.**
Postgres is not declared in `zerops.yml` at all (it is provisioned out-of-band), so there is no
backup schedule, retention policy, or tested restore path in this repo. Migrations have no down
migration; a bad one on the single container this app is pinned to (see below) is a hand-written
SQL recovery under pressure. Set up Zerops' own Postgres backup schedule before real users' data
depends on this, and treat "have I actually restored from a backup once" as the bar, not "a backup
exists somewhere."

**The backend must stay pinned to one container** (`minContainers: 1, maxContainers: 1`, set via
the Zerops GUI's Service → Scaling panel or the project-import YAML — **not** `zerops.yml`, which
is the push/build/run pipeline config and has no scaling keys). Four separate in-process stores
assume exactly one container: `ratelimit.ts`'s counters, `live.ts`'s SSE fan-out (both carry a
`ponytail:` comment naming Valkey as the upgrade), the GitHub proxy cache, and — the one that is a
hard break rather than a degradation — `cliLogins` in `index.ts`, where a `POST
/api/cli-login/start` landing on one container and the browser's claim landing on another turns
into `kerf login` failing outright, unfixable by retry. Move `cliLogins` to Valkey first if this
ever needs a second replica; `publish()` and `rateLimit()` after.

**Auth currently runs on a Clerk DEVELOPMENT instance** (`zerops.yml`'s `CLERK_PUBLISHABLE_KEY` /
`CLERK_SECRET_KEY`, sourced from Zerops project env) — capped at ~100 users, no production origin
allow-list. `apps/backend/src/auth.ts`'s `clerkAuthorizedParties()` (env `CLERK_AUTHORIZED_PARTIES`,
comma-separated origins) is wired into `clerkMiddleware()` and ready for a production instance; the
instance itself has to be created in the Clerk dashboard and its keys swapped into Zerops project
env before this is a real auth boundary for strangers.

## Diagrams and wireframes

- FigJam board `EuViTi5StQyv5uWSiOhO3X` — exactly 3 pages (Main, Backend, Frontend), each carrying
  its own tech stack. Do not add pages.
- Design file `VdPEaCxSvkLqEKibE5qpRE` — nine low-fi wireframes, SUSE + SUSE Mono, `sidebar-07`
  shell on every screen.

Both links are in `BUILD_LOG.md`. When editing either: nodes must be sized to their text — the user
has rejected these twice for clipped/overlapping labels.
