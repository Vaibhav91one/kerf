# HANDOFF — Kerf

You are picking up work from another agent. **Nothing has been built.** No repo, no code. This
directory is empty apart from `.claude/`.

**The spec is at `~/Documents/app-specs/kerf-spec.md`.** Read it first — it is the deliverable and it
is complete. This document holds only what the spec cannot carry: how the design got here, what is
verified versus assumed, and what will trip you up.

The spec is **drafted, not approved.** Do not start building until the user approves it.

---

## 1. What Kerf is, in one line

A competitive league for people who work with coding agents. Your Claude Code and Codex transcripts
are the match record. Each month is a season ranked on exactly one metric.

## 2. How it got here — do not re-litigate

The session started as idea-hunting for the Zerops Challenge hackathon and moved through a long
funnel. These were considered and **rejected for stated reasons**:

| Idea | Killed because |
|---|---|
| MCP server for Zerops | official `zeropsio/zcp` already exists — Go, ~2.7k commits, hosted, public preview |
| One-click app store | `zeropsio/recipes` already does it (135 repos) |
| `zerops-migrate` (compose → Zerops config) | user rejected; too plumbing-like, not a product |
| GEO / AI-visibility monitor | collection is expensive (Bright Data/Oxylabs) or ToS-grey (authenticated browser automation); `elmohq/elmo` already ships it open-source, pushed 2026-08-09 |
| Prompt validator ("what your prompt should have been") | **no ground truth** — an LLM grading an LLM's input |
| Bot arena / prompt-battle game | a misreading of "game"; the user meant users competing on their own agent metrics, not writing game bots |
| Submitting an existing Desktop project | hackathon bars previously finished work; public git history shows months of pre-event commits |

Two ideas from the funnel survive **inside** the spec and should not be re-invented:

- The prompt-validator's flaw is why the spec is organised around Tier A/B metrics (§5.5). Kerf is
  that idea with a denominator.
- The bot arena's one durable lesson — *a competitive product with no opponents on day one is
  nothing* — became the ghosts mechanic (§7.6).

## 3. Verified vs unverified — this distinction matters

**Verified by direct inspection of this machine. Trust these:**
- Every transcript schema claim in spec §5.1, §5.2, §5.4 — field names, record counts, type
  distributions. Read from actual JSONL, not from documentation.
- Corpus sizes: Codex 4,037 sessions; Claude Code 143 main + 1,053 subagent across two roots.
- Installed prior art: `cursor-history` v0.16.0, CodexBar (already probes `.claude/`), `headroom-ai`.
  No `ccusage`, no wakatime.
- Cursor storage shapes: IDE `state.vscdb` has 1.17 M `bubbleId:` rows; CLI `store.db` is
  content-addressed protobuf.

**NOT verified. Do not present as fact:**
- The name "Kerf" is not collision-checked. The session's web-search budget was fully exhausted
  (200/200 calls). Spec §0.1 says so.
- The competition table (spec §1.3) is **local-only** — what is installed on this Mac. No web scan
  was possible.
- Zerops platform details in spec §11 come from docs read earlier, not from a working deployment.
  Nothing has been deployed anywhere.

**Research artifact:** a 107-agent deep-research run on the AI-visibility market produced a cited
report at
`/private/tmp/claude-501/-Users-vaibhavtomar-Desktop-zerops/75cc0c52-8724-4276-b7a5-0ff44c17dd10/tasks/w0yz1yk1e.output`.
Temp directory — it may be gone. Its load-bearing conclusion is already encoded in spec §5.5 and
§7.2: unvalidated composite metrics are the failure mode to design against. Headline evidence, if you
need to defend those sections: cross-engine source Jaccard 0.11–0.18 (peer-reviewed, SIGIR 2026),
day-to-day citation Jaccard 0.34–0.42, brand-ranking reliability ~0.01 from a single observation.

## 4. Decisions with their reasoning, so you can defend or overturn them on merit

1. **Rejection rate, not correction rate.** There is no `isCorrection` field. Explicit rejection
   (`interruptedMessageId`, `toolDenialKind`, `toolUseResult.userModified`) is structural; a typed
   redirect is indistinguishable from a new instruction without reading prompt text, which the
   privacy invariant forbids. This gap is why the whole Tier A/B system exists.
2. **Rotating single-metric seasons.** A game needs one legible rank; the honesty rule forbids
   unvalidated composites. One metric per season resolves the conflict and incidentally fixes the
   permanent-incumbent problem and the staleness problem.
3. **Privacy enforced by schema shape, not by review.** No unbounded strings in the payload; CI walks
   a real payload and fails on any string that is not a hash, timestamp, or enum member.
4. **Metrics computed client-side.** The server cannot recompute them, which is what makes the
   privacy claim true rather than aspirational.
5. **Codex in scope from milestone 2.** It is 28× the Claude Code corpus on this machine.
6. **Cursor deferred, may never ship.** IDE lacks token counts at the SQL layer; CLI is protobuf.
7. **Two kill gates, not one.** M3 asks whether the score feels true to its own author. M5 asks
   whether a second person finishes a season. A social product can pass the first and fail the
   second, and that is worth finding out before building badges.

## 5. Open questions — for the user, not for you

- **Hackathon or product?** The Zerops Challenge window (Aug 8–9 2026) is closing or closed. Kerf's
  correct design is local-first, which is a weak hackathon entry by construction (spec §0.3).
- **Name.** Blocked on a collision check that could not be run.
- **Approval to build.** Not given.

## 6. The user's working style — match it

- **Terse output.** Caveman mode active: drop filler, keep technical substance.
- **Ponytail active:** laziest solution that works, stdlib before dependencies, no speculative
  abstractions, mark deliberate simplifications with a `ponytail:` comment.
- **Karpathy guidelines active:** surgical diffs, surface assumptions, no unrequested scope.
- **Spec-first.** Specs live in `~/Documents/app-specs/` (cornice, sectionize, tappi, carte). The Kerf
  spec deliberately mirrors `cornice-spec.md`: named rules referenced by section symbol, tier
  systems, kill gates, amendments with declared precedence, tables over prose, real numbers over
  adjectives. Read cornice's spec before writing any more spec text.
- **They push back on premises and are usually right.** It happened four separate times in this
  session — including catching that "game" had been misread as a literal game. Verify before
  defending.

## 7. Stack conventions (from their other repos — follow them)

pnpm workspaces · Node 22 · TypeScript · `node --test`, not Jest or Vitest · `node:util parseArgs`,
not commander or yargs · packages consumed as raw TS source · Prisma + Postgres where a DB is needed.
Reference implementation for the CLI + MCP shape: `~/dev/cornice/apps/cli/`.

## 8. Machine constraints

- **No Docker installed, deliberately.** Local containers run under Apple's `container` runtime; see
  `~/dev/cornice/scripts/db.sh`.
- Ports 3000 and 5432 are occupied by other projects. Cornice took 3210 and 5433. Pick free ports and
  pin them.

## 9. Landmines

- **`~/dev/cornice` has 54 uncommitted files and no git remote.** Three days of finished, tested work
  exists only on that disk. Do not run destructive git commands there. The user has been told twice
  and has not acted.
- `~/Desktop/Content Automation/` and `shorts-clipper/` contain `client_secret_*.json`;
  `~/Desktop/Douyin` has `.env` and `CREDENTIALS.md`. Nothing from those goes into a public repo.
- **Transcripts are both the product's input and the user's entire prompt history.** Read them for
  schema. Never print their contents back — not in logs, not in test fixtures, not in a report.

## 10. What to do first

1. Get approval on the spec, or amend it to their feedback.
2. Build milestone 1 only. Its gate is real: token totals within 1% of the
   `toolUseResult.totalTokens` cross-check, on their actual 143-session corpus.
3. Do not build past milestone 3 without them running a full season against their own history and
   saying the tier feels true. It is a kill gate, not a checkpoint.
