// The single home for what used to be twenty explanatory sentences scattered
// across every screen. Nothing here is a new claim — each line is the behaviour
// enforced in code: kerf-spec.md §6, apps/backend/src/validate.ts, and
// packages/shared/src/social.ts.
//
// A server component; there is nothing to fetch.

import { PageHeader, Panel, SectionLabel } from '@/components/kerf/ui';

// Exactly the keys validate.ts accepts on POST /api/metrics, in schema order.
const PAYLOAD_FIELDS =
  'sessionId · projectHash · startedMs · endedMs · turns · edits · editsRework · reworkRatio · qualifies · toolCounts';

const SECTIONS: { label: string; body: string[] }[] = [
  {
    label: 'WHAT NEVER LEAVES YOUR MACHINE',
    body: [
      'Prompts, responses, file contents, file paths, project names, and diffs. None of it is stored, transmitted, or renderable — there is no table it could go in, by design.',
      'The CLI reads ~/.claude/projects and nothing else, and it never writes back.',
    ],
  },
  {
    label: 'LIVE SESSIONS',
    body: [
      'A heartbeat carries a session id, a project hash, and four counters. It cannot carry a prompt, a file path, or a diff — the backend rejects the whole payload if it tries.',
      'A live tile exists only while kerf live is running, and goes dark 60 seconds after the last heartbeat.',
      'A session working in a project you marked private is not shown at all — not to visitors, and not to you. Your own status still reads Live, because that comes from your account rather than the public feed.',
    ],
  },
  {
    label: 'SKILLS AND TOOLS',
    body: [
      'Counts per name only, never arguments. A skill name is a slug Claude Code stamped on the turn itself; the arguments beside it are never read, and neither is a slash command’s text.',
      'Your skills stay private until you turn the switch on in your account. It is off by default.',
      'You can also hide individual skills and MCP servers. A hidden one leaves your public profile and the league totals — hidden from everyone, so the numbers stay the same for every viewer. You still see it on your own account.',
    ],
  },
  {
    label: 'PROJECTS',
    body: [
      'A session is linked to a project by sha256 of the local path. The path itself is never sent, so an unpublished project stays a row of numbers with no name attached.',
      'A published project can still be private. Private is not the same as unpublished: unpublished means we never had a name for it, private means you gave us one and chose who sees it.',
    ],
  },
  {
    label: 'WHAT YOU PUBLISH IS DIFFERENT',
    body: [
      'Profiles, projects, chat and shared skills hold free text — because a human typed it into a form and chose to publish it. Nothing there is derived from a transcript.',
      'Publishing is not the same as making it public. A project or a shared skill can be published privately, and a private row is absent from every list, every detail page and every search — not greyed out, not blanked, absent. Asking for one by id or slug answers the same way as asking for one that never existed.',
      'The listing commands (kerf skills, kerf projects) print to your terminal and make no network call. Only publish transmits, and only what you named.',
    ],
  },
  {
    label: 'OTHER PEOPLE',
    body: [
      'Session-level history stays with its owner. A visitor sees a standing, badges and published projects — never the individual sessions behind them.',
    ],
  },
  {
    label: 'YOUR CLI AND YOUR TOKEN',
    body: [
      'Kerf never signs in to Claude on your behalf. You run the CLI locally and it posts numbers using a token you hold.',
      'kerf login mints that token and never displays it — only its sha256 digest reaches the server, so nobody, including this site, can read it back to you. Running kerf login again issues a fresh one and overwrites the old on disk; revoking the previous token is not built yet.',
    ],
  },
  {
    label: 'INSIGHTS',
    body: ['Every tip is a threshold comparison on numbers you already uploaded. No model reads your transcripts.'],
  },
];

export default function PrivacyPage() {
  return (
    <div className="space-y-[28px]">
      <PageHeader title="What leaves your machine" />

      <Panel>
        <SectionLabel>THE WHOLE PAYLOAD</SectionLabel>
        <p className="mt-[12px] max-w-[1060px] font-mono text-[15px] leading-[23px] text-muted-foreground">
          {PAYLOAD_FIELDS}
        </p>
        <p className="mt-[22px] max-w-[1060px] text-[15px] leading-[20px] text-muted-foreground">
          Numbers, timestamps, enums and hashes. That is the entire list. The backend walks every upload against it and
          rejects anything carrying an extra field — it does not strip and store, it refuses.
        </p>
      </Panel>

      <div className="grid grid-cols-2 gap-5">
        {SECTIONS.map((section) => (
          <Panel key={section.label} className="min-h-[180px]">
            <SectionLabel>{section.label}</SectionLabel>
            <div className="mt-[12px] space-y-[12px]">
              {section.body.map((line) => (
                <p key={line} className="max-w-[520px] text-[15px] leading-[20px] text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      <Panel>
        <p className="max-w-[1060px] text-[15px] leading-[20px] text-muted-foreground">
          Kerf is open source. None of the above has to be taken on trust — read the extractor before you run it.
        </p>
      </Panel>
    </div>
  );
}
