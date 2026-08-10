# Kerf

Competitive league for coding-agent CLI users. Claude Code transcripts are the match record; each
season ranks on one Tier-A metric. Full spec: `~/Documents/app-specs/kerf-spec.md` (authoritative —
read it before changing scoring/privacy/season logic). Design history: `HANDOFF.md`.

Built for the Zerops Challenge hackathon, submission night 2026-08-09. **Tonight's scope is
deliberately narrower than the spec**: Claude Code only (Codex deferred), rework ratio is the only
season metric, no rivals. Multi-account, live feed, chat, public profiles and build-in-public
projects are in — added after the user expanded scope on submission day. The project itself is open
source and built in public.

## Stack

pnpm workspaces, Node 22, TypeScript, raw-TS packages (no build step,
`allowImportingTsExtensions`), `node --test` (not Jest/Vitest), `node:util parseArgs` (not
commander/yargs). Mirrors `~/dev/cornice`'s conventions — that repo is a read-only reference, never
edit it.

- `packages/shared` — types (`schema.ts`), pure scoring logic (`metrics.ts`, `season.ts`,
  `insights.ts`), gamification (`game.ts` — badges/streaks, display-only per §7.2), and the
  Path-B sanitisers (`social.ts` — length caps, control-char/bidi stripping, repo-URL scheme
  allow-list). No I/O.
- `apps/cli` — extractor. Reads `~/.claude/projects` JSONL only (default profile — user has other
  `.claude-*` profile dirs on their machine, deliberately excluded), computes
  `SessionMetric`. `kerf sync` uploads finished sessions; `kerf live` beats every 15s for
  in-flight ones (`POST /api/heartbeat`). `kerf login` starts the browser/device flow, opens the
  dashboard, and stores the issued API token in `~/.kerf/config.json`; `kerf logout` removes it.
- `apps/backend` — Express + Prisma + Postgres. Clerk Google auth owns dashboard identity; CLI/API
  auth uses per-account API tokens minted after Clerk sign-in (raw token shown once, only sha256
  digest stored). Legacy token lookup is left as a compatibility fallback. No `event` table, by
  design (privacy: raw events never leave the user's machine). Tables: `session_metrics`,
  `profiles`, `api_tokens`, `live_sessions`, `projects`, `chat_messages`, `skills_library`,
  `skill_stars` — no persisted `season` (tier cuts computed live). Real-time is SSE
  (`GET /api/live/stream`), fanned out by an in-process `EventEmitter` in `src/live.ts`. RBAC is
  route-local in `src/index.ts`: public reads stay public, Clerk session routes manage browser
  account lifecycle, and member routes derive ownership from Clerk/API tokens only.
- `apps/frontend` — Next.js dashboard, built from the `Material 3 — Platform` comps (Figma page
  `105:2`): Tailwind + shadcn/ui on the `sidebar-07` shell, SUSE + SUSE Mono. The Figma variable
  collection is mapped onto shadcn's own token names in `globals.css`, so light and dark are one
  component set and every `ui/*` primitive inherits the palette. Icons live in
  `components/kerf/icons.tsx` (exported path data, `currentColor`); league crests, badges, avatars
  and illustrations are files under `public/kerf/` and are never recoloured. Routes: `/`, `/live`,
  `/u/[handle]`, `/people`, `/skills`, `/projects`, `/me`, `/season`, `/insights`. `/people` is the
  rail's People entry — the board draws the profile screen as its destination and no index, so the
  directory is deliberately plain. Do not invent routes beyond these. Public-first: no frontend
  Clerk proxy/middleware; sign-in is needed only for `/me`, CLI connect, and mutating actions.

Run `pnpm install` once at the root. `pnpm -r typecheck` / `pnpm -r test` run across all packages.

Local dev ports: 3000/5432 are occupied by other projects on this machine, 3210/5433 are taken by
cornice. Pick different free ports for local dev servers if any app needs one; Zerops assigns its own
ports in deployment regardless.

## Privacy invariant (spec §6) — do not weaken

§6 governs **transcript-derived** data. Two ingress paths, and the distinction is load-bearing:

- **Path A — telemetry** (`POST /api/metrics`, `POST /api/heartbeat`). Only hashes, enums,
  timestamps, and numbers may leave the user's machine. No free-text strings, ever. Both routes
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

- **Follow** (profile button, "People I follow" filter). No follow graph exists. Both controls are
  rendered as the comps draw them but inert, rather than wired to nothing.
- **A visitor's session table** (Profile). `GET /api/profiles/:handle` deliberately serves no
  per-session detail for someone else's account (§6). The table appears on your own profile only;
  a visitor gets a line saying why it is absent.
- **"Cuts unlock at 5 players"** (empty state). `tierCuts()` computes from whatever it has. The copy
  is rendered with live counts and the threshold is a display constant — nothing enforces it.
- **Manual token paste** (Me). That comp predates Clerk. The three steps keep its shape but describe
  `kerf login`, which mints the token and never displays it. Token rotation says what actually
  happens: a new token is issued, the old one is not yet revocable.
- **Live-feed / projects visibility switches** (Me). Only `publicSkills` is a stored preference. The
  other two rows explain the behaviour instead of showing switches that flip nothing.

Four routes gained fields so a designed element could be real rather than faked:
`season/current` now returns a 10-bucket `histogram` and a per-handle `streak` (display-only —
§7.2 still orders on the ratio alone); `/api/skills` returns `topUsers` per tool; `/api/projects`
returns `sessionCount`; and `improvementTips()` returns the `title` and the `trigger` rule that
fired it, which is what the Insights comp prints beside each tip.

## Known spec deviations (verified against real data, not assumed)

- **No `origin.kind` field exists** in real Claude Code transcripts, despite spec §5.4 claiming
  `type=="user" && origin.kind=="human"` for human-turn detection. Live JSONL files have no `origin`
  field anywhere. `apps/cli/src/extract.ts` uses a practical substitute instead: a `user` record is a
  human turn unless its `message.content` array contains a `tool_result` block. Documented inline in
  the extractor; flag to the user if this heuristic misclassifies anything during a real demo.
- **Subagent transcripts are not recursed tonight.** Rework ratio comes from main-session Edit/Write
  calls only. User confirmed this is acceptable for tonight's submission — revisit when a
  tokens-per-session metric ships (needs the same recursion, same rule about never double-counting a
  subagent's totalTokens against its parent).
- **Season-level qualification floor is session-level only tonight.** Spec §7.4's "10 sessions + 5
  commits per season" floor needs a git-log connector that isn't built. Only the session-level floor
  (≥3 human turns, ≥1 edit) is enforced. User confirmed this is acceptable for tonight.

## Verification state

`packages/shared`, `apps/cli` and `apps/backend` are typechecked and unit-tested (`node --test`):
39 shared / 33 backend / 1 cli cases pass. The extractor is verified end-to-end against the user's
real `~/.claude/projects` corpus (27 sessions parsed, 7 qualify, avg rework ratio 0.369 as of last
run — re-run `node apps/cli/src/index.ts` to refresh). The backend is verified against a real local
Postgres end-to-end (`scripts/e2e.mjs` — needs `scripts/db.sh up` and a booted server): SSE fan-out, per-account token auth, the
cross-account overwrite guard, chat rate limiting, and both privacy gates rejecting a smuggled
free-text field. Clerk mode is smoke-tested locally: `/api/cli-login/start` returns a pending login,
unauthenticated claim returns 401 rather than silently falling back, and the frontend production
build has no Proxy/Middleware entry. The production frontend is built and deployed on Zerops.

## Diagrams and wireframes

- FigJam board `EuViTi5StQyv5uWSiOhO3X` — exactly 3 pages (Main, Backend, Frontend), each carrying
  its own tech stack. Do not add pages.
- Design file `VdPEaCxSvkLqEKibE5qpRE` — nine low-fi wireframes, SUSE + SUSE Mono, `sidebar-07`
  shell on every screen.

Both links are in `BUILD_LOG.md`. When editing either: nodes must be sized to their text — the user
has rejected these twice for clipped/overlapping labels.
