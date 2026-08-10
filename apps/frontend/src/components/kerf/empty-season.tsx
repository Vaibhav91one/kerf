'use client';

// Screen `Light / 09 Empty` (131:442) and its dark twin (133:2146). Rendered by
// Home whenever the season has no qualifying sessions at all.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type SeasonCurrent } from '@/lib/api';
import { Illustration } from '@/components/kerf/artwork';
import { PageHeader, Panel, SectionLabel, StatCard } from '@/components/kerf/ui';

// The comp states the season opens once five players qualify. The backend
// computes cuts from whatever it has, so this is a display threshold only —
// it is not enforced in tierCuts().
const PLAYERS_FOR_CUTS = 5;

const COMMANDS = [
  { cmd: 'npm i -g kerf', note: '' },
  { cmd: 'kerf', note: '# dry run, nothing leaves your machine' },
  { cmd: 'kerf sync', note: '# upload history' },
  { cmd: 'kerf live', note: '# heartbeat every 15s' },
];

function LiveSkeletonRow() {
  return (
    <div className="flex h-[54px] items-center gap-3 rounded-[12px] px-4">
      <span className="size-2 rounded-[4px] bg-secondary" />
      <div className="space-y-[6px]">
        <div className="h-[12px] w-[120px] rounded-[6px] bg-secondary" />
        <div className="h-[8px] w-[70px] rounded-[4px] bg-secondary" />
      </div>
    </div>
  );
}

export function EmptySeason() {
  const [season, setSeason] = useState<SeasonCurrent | null>(null);

  useEffect(() => {
    api.seasonCurrent().then(setSeason).catch(() => {});
  }, []);

  const players = season?.standings.length ?? 0;

  return (
    <div className="space-y-[28px]">
      <PageHeader
        title="Season 1 has not started"
        subtitle={`Kerf needs ${PLAYERS_FOR_CUTS} qualifying players before it computes a single cut. Right now it has ${players}.`}
      />

      <Panel className="relative flex h-[260px] flex-col justify-center p-10">
        <h2 className="text-[24px] font-semibold leading-[30px] text-foreground">Nothing to rank yet</h2>
        <p className="mt-[10px] max-w-[800px] text-[14px] leading-[20px] text-muted-foreground">
          You have not uploaded a session, so there is no ratio, no tier and no streak to show. That is the honest
          empty state — kerf will not invent a number to fill the space.
        </p>
        <div className="mt-6 flex gap-4">
          <Link
            href="/me"
            className="flex h-[44px] w-[200px] items-center justify-center rounded-[12px] bg-primary text-[13px] font-medium text-primary-foreground"
          >
            Connect your CLI
          </Link>
          <a
            href="https://github.com/Vaibhav91one/kerf"
            target="_blank"
            rel="noreferrer"
            className="flex h-[44px] w-[180px] items-center justify-center rounded-[12px] border border-border bg-card text-[13px] font-medium text-foreground"
          >
            Read the spec
          </a>
        </div>
        <Illustration name="empty-season" width={199} className="absolute right-[74px] top-[44px]" />
      </Panel>

      <div className="grid grid-cols-4 gap-5">
        <StatCard label="YOUR REWORK RATIO" value="—" foot="no qualifying session yet" />
        <StatCard label="TIER" value="Unranked" foot="needs 1 qualifying session" />
        <StatCard label="STREAK" value="0 days" foot="starts on your first upload" />
        <StatCard
          label="PLAYERS IN SEASON"
          value={`${players} / ${PLAYERS_FOR_CUTS}`}
          foot={`cuts unlock at ${PLAYERS_FOR_CUTS}`}
        />
      </div>

      <div className="grid grid-cols-[740fr_340fr] gap-5">
        <Panel className="flex flex-col">
          <SectionLabel>THREE COMMANDS AND YOU ARE IN</SectionLabel>
          <div className="mt-[12px] rounded-[16px] border border-border px-5 py-[22px]">
            {COMMANDS.map(({ cmd, note }) => (
              <p key={cmd} className="font-mono text-[13px] leading-[34px] text-muted-foreground">
                {note ? `${cmd.padEnd(20)}${note}` : cmd}
              </p>
            ))}
          </div>
          <p className="mt-[22px] max-w-[700px] text-[12px] leading-[15px] text-muted-foreground">
            The dry run prints counts only, so you can see exactly what would be uploaded before anything is.
          </p>
          <p className="mt-[27px] max-w-[700px] text-[12px] leading-[15px] text-muted-foreground">
            Kerf is open source — read the extractor before you trust it with anything.
          </p>
        </Panel>

        <Panel>
          <SectionLabel>NOBODY IS LIVE</SectionLabel>
          <p className="mt-[8px] max-w-[300px] text-[13px] leading-[17px] text-muted-foreground">
            When someone runs <code className="font-mono">kerf live</code>, their tile appears here within 15 seconds.
          </p>
          <div className="mt-[52px] space-y-3">
            <LiveSkeletonRow />
            <LiveSkeletonRow />
            <LiveSkeletonRow />
          </div>
        </Panel>
      </div>

      <Panel className="h-[110px]">
        <SectionLabel>WHY IT IS EMPTY AND NOT FAKE</SectionLabel>
        <p className="mt-[9px] max-w-[1000px] text-[13px] leading-[17px] text-muted-foreground">
          No seeded users, no demo rows, no placeholder ratios. A league that ships with invented standings has
          nothing left to measure.
        </p>
      </Panel>
    </div>
  );
}
