'use client';

// Screen `Light / 02 Live` (130:2) and its dark twin (133:1207).

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LIMITS, tierForValue, type TierCuts } from '@kerf/shared';
import {
  api,
  liveStreamUrl,
  type ChatMessageJson,
  type LiveSessionJson,
  type ProjectJson,
  type SeasonCurrent,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader, Panel, SectionLabel } from '@/components/kerf/ui';

type Ended = { handle: string; sessionId: string; endedAtMs: number; durationMs: number; reworkRatio: number | null };

function parseEvent<T>(e: MessageEvent): T | null {
  try {
    return JSON.parse(e.data) as T;
  } catch {
    return null;
  }
}

// A tile is only "ended in the last hour" for that long, exactly as the panel says.
const ENDED_WINDOW_MS = 60 * 60_000;

function elapsed(ms: number): string {
  const secs = Math.max(0, Math.floor(ms / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${String(secs % 60).padStart(2, '0')}s`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-[112px]">
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-[3px] font-mono text-[22px] leading-[28px] text-foreground">{value}</p>
    </div>
  );
}

function LiveTile({
  s,
  projectName,
  cuts,
  nowMs,
}: {
  s: LiveSessionJson;
  projectName: string | null;
  cuts: TierCuts | null;
  nowMs: number;
}) {
  const pace = cuts && s.reworkRatio !== null ? tierForValue(s.reworkRatio, cuts, false) : null;
  return (
    <div className="h-[180px] rounded-[16px] border border-border bg-card px-[18px] pt-[15px]">
      <div className="flex items-baseline gap-2">
        <span className="size-2 shrink-0 self-center rounded-full bg-live" />
        <Link href={`/people/${s.handle}`} className="text-[15px] font-semibold text-foreground hover:underline">
          @{s.handle}
        </Link>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{elapsed(nowMs - s.startedMs)}</span>
      </div>
      <p className="mt-[11px] text-[12px] leading-[15px] text-muted-foreground">{projectName ?? 'private project'}</p>
      <div className="mt-[19px] flex">
        <Stat label="TURNS" value={String(s.turns)} />
        <Stat label="EDITS" value={String(s.edits)} />
        <Stat label="REWORK" value={s.reworkRatio === null ? '—' : s.reworkRatio.toFixed(2)} />
      </div>
      <div className="mt-[18px] h-[6px] rounded-[3px] bg-secondary" />
      <p className="mt-[8px] text-[11px] leading-[14px] text-muted-foreground">
        {pace ? `pace: ${pace} if it holds` : 'pace: no edits yet'}
      </p>
    </div>
  );
}

const FILTERS = ['All', 'People I follow', 'My projects'] as const;
type Filter = (typeof FILTERS)[number];

export default function LivePage() {
  const { auth, getToken } = useAuth();
  const [sessions, setSessions] = useState<Map<string, LiveSessionJson>>(new Map());
  const [ended, setEnded] = useState<Ended[]>([]);
  const [messages, setMessages] = useState<ChatMessageJson[]>([]);
  const [projects, setProjects] = useState<ProjectJson[]>([]);
  const [season, setSeason] = useState<SeasonCurrent | null>(null);
  const [watching, setWatching] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('All');
  const [body, setBody] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  // The last beat we saw for a session, so an ended tile can still report its
  // duration and ratio — session-end itself carries only the id.
  const lastSeen = useRef<Map<string, LiveSessionJson>>(new Map());

  useEffect(() => {
    api
      .liveSessions()
      .then((r) => {
        setSessions(new Map(r.sessions.map((s) => [s.sessionId, s])));
        for (const s of r.sessions) lastSeen.current.set(s.sessionId, s);
      })
      .catch(() => {});
    api.chatHistory().then((r) => setMessages(r.messages)).catch(() => {});
    api.projects().then((r) => setProjects(r.projects)).catch(() => {});
    api.seasonCurrent().then(setSeason).catch(() => {});
    api.health().then((h) => setWatching(h.streams)).catch(() => {});

    const es = new EventSource(liveStreamUrl());
    es.addEventListener('session', (e) => {
      const s = parseEvent<LiveSessionJson>(e);
      if (!s) return;
      lastSeen.current.set(s.sessionId, s);
      setSessions((prev) => new Map(prev).set(s.sessionId, s));
    });
    es.addEventListener('session-end', (e) => {
      const data = parseEvent<{ sessionId: string; handle: string }>(e);
      if (!data) return;
      const { sessionId, handle } = data;
      const last = lastSeen.current.get(sessionId);
      setSessions((prev) => {
        const next = new Map(prev);
        next.delete(sessionId);
        return next;
      });
      if (last) {
        setEnded((prev) => [
          {
            handle,
            sessionId,
            endedAtMs: Date.now(),
            durationMs: last.lastBeatMs - last.startedMs,
            reworkRatio: last.reworkRatio,
          },
          ...prev,
        ]);
      }
    });
    es.addEventListener('chat', (e) => {
      const m = parseEvent<ChatMessageJson>(e);
      if (!m) return;
      setMessages((prev) => [...prev.slice(-49), m]);
    });
    return () => es.close();
  }, []);

  // Elapsed labels tick with the CLI's own beat interval.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function sendChat(e: FormEvent) {
    e.preventDefault();
    if (!auth || !body.trim()) return;
    setChatError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('not signed in');
      await api.postChat(token, body.trim());
      setBody('');
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to send');
    }
  }

  const projectName = (id: string | null) => (id ? projects.find((p) => p.id === id)?.name ?? null : null);
  const myProjectIds = new Set(projects.filter((p) => p.handle === auth?.handle).map((p) => p.id));
  const all = [...sessions.values()];
  const tiles = filter === 'My projects' ? all.filter((s) => s.projectId && myProjectIds.has(s.projectId)) : all;
  const cuts = season?.cuts ?? null;
  const recentlyEnded = ended.filter((e) => nowMs - e.endedAtMs < ENDED_WINDOW_MS).slice(0, 3);

  return (
    <div className="space-y-[26px]">
      <PageHeader
        title="Live"
        subtitle={`${all.length} session${all.length === 1 ? '' : 's'} beating right now. A tile goes dark 60s after the last heartbeat. Numbers only — no file names, no prompts.`}
      />

      <div className="grid grid-cols-[740fr_340fr] gap-5">
        <div>
          <div className="flex gap-[10px]">
            {FILTERS.map((f) => {
              // There is no follow graph in the API, so that filter is present
              // and inert rather than silently doing nothing.
              const unavailable = f === 'People I follow';
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  disabled={unavailable}
                  aria-disabled={unavailable}
                  onClick={() => !unavailable && setFilter(f)}
                  title={unavailable ? 'Following is not built yet' : undefined}
                  className={`h-[34px] w-[120px] rounded-[17px] border border-border bg-card text-[12px] ${
                    active ? 'font-medium text-foreground' : 'text-muted-foreground'
                  } ${unavailable ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {f}
                </button>
              );
            })}
          </div>

          <div className="mt-[18px] grid grid-cols-2 gap-5">
            {tiles.map((s) => (
              <LiveTile key={s.sessionId} s={s} projectName={projectName(s.projectId)} cuts={cuts} nowMs={nowMs} />
            ))}
          </div>
          {tiles.length === 0 && (
            <p className="mt-[18px] text-[13px] text-muted-foreground">No one is live right now.</p>
          )}

          <Panel className="mt-5 h-[190px]">
            <SectionLabel>ENDED IN THE LAST HOUR</SectionLabel>
            <p className="mt-[6px] max-w-[700px] text-[11px] leading-[14px] text-muted-foreground">
              A tile moves here 60s after its last beat, then the session uploads as history.
            </p>
            <div className="mt-[22px]">
              {recentlyEnded.map((e) => (
                <div key={e.sessionId} className="flex py-[7px] text-[13px]">
                  <Link href={`/people/${e.handle}`} className="w-[182px] font-medium text-foreground hover:underline">
                    @{e.handle}
                  </Link>
                  <span className="w-[160px] font-mono text-muted-foreground">{elapsed(e.durationMs)}</span>
                  <span className="w-[160px] font-mono text-muted-foreground">
                    {e.reworkRatio === null ? '—' : e.reworkRatio.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">
                    {cuts && e.reworkRatio !== null ? tierForValue(e.reworkRatio, cuts, false) : '—'}
                  </span>
                </div>
              ))}
              {recentlyEnded.length === 0 && (
                <p className="text-[13px] text-muted-foreground">Nothing has ended while you have been watching.</p>
              )}
            </div>
          </Panel>

          <Panel className="mt-5 h-[130px]">
            <SectionLabel>WHY THIS IS SAFE TO WATCH</SectionLabel>
            <p className="mt-[8px] max-w-[700px] text-[13px] leading-[17px] text-muted-foreground">
              A heartbeat carries a session id, a project hash, and four counters. It cannot carry a prompt, a file
              path, or a diff — the backend rejects the whole payload if it does.
            </p>
          </Panel>
        </div>

        <Panel className="flex h-[950px] flex-col">
          <SectionLabel>LIVE CHAT</SectionLabel>
          <p className="mt-[5px] text-[12px] leading-[15px] text-muted-foreground">
            {watching === null ? '—' : `${watching} watching`}
          </p>
          <hr className="mt-[13px] border-t border-border" />

          <div ref={scrollRef} className="mt-[18px] flex-1 space-y-[20px] overflow-y-auto pr-1">
            {messages.map((m) => (
              <div key={m.id}>
                <Link href={`/people/${m.handle}`} className="text-[12px] font-semibold text-foreground hover:underline">
                  @{m.handle}
                </Link>
                <p className="mt-[5px] max-w-[296px] text-[13px] leading-[17px] text-muted-foreground">{m.body}</p>
              </div>
            ))}
            {messages.length === 0 && <p className="text-[13px] text-muted-foreground">No messages yet.</p>}
          </div>

          <form onSubmit={sendChat} className="mt-4">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={LIMITS.chatBody}
              disabled={!auth}
              placeholder={auth ? 'Say something…' : 'Connect your CLI to chat'}
              className="h-[44px] w-full rounded-[10px] bg-card px-4 text-[13px] text-foreground outline-none ring-1 ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
            <p className="mt-[12px] text-[10px] leading-[13px] text-muted-foreground">
              {LIMITS.chatBody} chars · 5 messages per 10s · control chars stripped
            </p>
            {chatError && <p className="mt-1 text-[11px] text-destructive">{chatError}</p>}
          </form>
        </Panel>
      </div>
    </div>
  );
}
