<div align="center">

<img src="apps/frontend/src/app/icon.svg" width="64" height="64" alt="Kerf" />

# Kerf

**A league for coding-agent CLI users.**
Your transcripts stay on your machine — only numbers travel.

[![CI](https://github.com/Vaibhav91one/kerf/actions/workflows/ci.yml/badge.svg)](https://github.com/Vaibhav91one/kerf/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-bdd063.svg)](./LICENSE)
[![kerf.vaibhav.quest](https://img.shields.io/badge/live-kerf.vaibhav.quest-121712)](https://kerf.vaibhav.quest)

[**Live app**](https://kerf.vaibhav.quest) · [Privacy](https://kerf.vaibhav.quest/privacy) · [Architecture notes](./CLAUDE.md)

</div>

---

**kerf** *(n.)* — the sliver of material a saw blade removes on its way through the wood. Not the
plank, not the sawdust pile — the thin, honest trace of the cut itself.

That's the bet this app makes: the most interesting signal in a coding-agent session was never
"lines changed" or "commits shipped." It's the *kerf* — how much of what got written had to be
cut away and redone. An agent that lands an edit clean on the first try is doing something a raw
diff count can't see. Kerf scores that, turns it into points and levels, and never once asks to
see what you actually typed.

## What it does

- **`kerf sync`** walks your local Claude Code (and Codex) transcripts, scores each session, and
  uploads the score. Never the transcript.
- **`kerf live`** heartbeats an in-progress session so a small tile lights up on the live feed
  while you work — gone again within a minute of you stopping.
- A dashboard — **Home · Live · Season · Rivals · Projects · Skills · People** — shows your
  standing, your badges, and whatever you've chosen to publish. Nothing is public by default.
- **Rivals** lets you follow up to three people and race them on the monthly board. **Projects**
  and **Skills** are opt-in, build-in-public surfaces you turn on a form, not a checkbox buried in
  settings.

## How a session scores

Three terms, computed entirely from counters that were already sitting in your transcript:

| Term | What it rewards |
|---|---|
| **Landed** | Edits that stuck, on a log scale — a 200-edit session can't bury a careful 20-edit one. |
| **Precision** | The share of edits that landed *first try*. The dominant term, on purpose. |
| **Focus** | Net edits per turn, capped — one giant write hits the ceiling instead of running away with the board. |

A session has to clear a small floor (3 human turns, 1 edit that stuck) before it scores at all,
and every UTC day is capped — so running the CLI more isn't a strategy, landing edits cleanly is.

## Privacy, in one paragraph

Only hashes, enums, timestamps, and numbers ever leave your machine — turn counts, edit counts,
how often an edit had to be redone, which tool names you used. Free text (prompts, responses, file
contents, file paths, project names) never leaves your machine, full stop. The one exception is
content *you* explicitly publish through a form — a project description, a shared skill, a chat
message — which is a different, clearly-labelled path. See [`/privacy`](https://kerf.vaibhav.quest/privacy)
in the running app, or `CLAUDE.md`'s "Privacy invariant" section for the enforced version of this
promise.

## Stack

pnpm workspaces, Node 22, TypeScript with no build step (`allowImportingTsExtensions`),
`node --test` instead of Jest/Vitest. Express + Prisma + Postgres on the backend, Next.js on the
front, Clerk for browser auth.

```
packages/shared   types, pure scoring logic, gamification, sanitisers — no I/O
apps/cli          the kerf CLI: login, sync, live, skills, projects
apps/backend      Express API + Postgres
apps/frontend     Next.js dashboard
```

## Running it locally

```bash
pnpm install
scripts/db.sh up                 # local Postgres
pnpm --filter @kerf/backend prisma:migrate
pnpm --filter @kerf/backend dev  # apps/backend/.env needed — see below
pnpm --filter @kerf/frontend dev
```

You'll need `apps/backend/.env` with at least `DATABASE_URL` and a port; Clerk keys are optional
locally (the app falls back to a legacy CLI-token flow when unset). Copy the shape from
`zerops.yml`'s `run.envVariables` block.

```bash
pnpm -r typecheck
pnpm -r test
```

## Contributing

Issues and PRs welcome. Read `CLAUDE.md` first — it documents the architecture, the privacy
invariant (§6, non-negotiable), and every place the shipped product deliberately deviates from the
original spec, with the reasoning for each. `BUILD_LOG.md` has the full build history, warts and
all.

## License

MIT — see [LICENSE](./LICENSE).
