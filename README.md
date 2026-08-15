# Kerf

A competitive league for coding-agent CLI users. Your Claude Code (and, soon, Codex) transcripts
are the match record — Kerf turns them into points, levels, badges, and a season board, without
ever uploading what you actually typed or the agent actually said.

## What it does

- **`kerf sync`** reads your local Claude Code transcripts (`~/.claude/projects`), computes a
  score per session, and uploads the score — never the transcript.
- **`kerf live`** heartbeats an in-progress session so it shows up on the live feed.
- A dashboard (`/`, `/live`, `/season`, `/me`, `/people`, `/projects`, `/skills`) shows your
  standing, badges, and what you've chosen to publish.
- Projects and skills are opt-in, build-in-public surfaces — nothing is public unless you publish
  it.

## Privacy, in one paragraph

Only hashes, enums, timestamps, and numbers ever leave your machine — turn counts, edit counts,
how often an edit had to be redone, which tool names you used. Free text (prompts, responses, file
contents, file paths, project names) never leaves your machine, full stop. The one exception is
content *you* explicitly publish through a form — a project description, a shared skill, a chat
message — which is Path B and is clearly a different thing. See `/privacy` in the running app, or
`CLAUDE.md`'s "Privacy invariant" section for the enforced version of this promise.

## Stack

pnpm workspaces, Node 22, TypeScript (no build step — `allowImportingTsExtensions`),
`node --test` (not Jest/Vitest). Express + Prisma + Postgres backend, Next.js frontend, Clerk for
browser auth.

```
packages/shared   — types, pure scoring logic, gamification, sanitisers. No I/O.
apps/cli          — the kerf CLI (login, sync, live, skills, projects).
apps/backend      — Express API + Postgres.
apps/frontend     — Next.js dashboard.
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
original spec, with the reasoning for each. `BUILD_LOG.md` has the full build history.

## License

MIT — see [LICENSE](./LICENSE).
