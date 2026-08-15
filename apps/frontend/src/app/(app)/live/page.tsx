'use client';

// Screen `Light / 02 Live` (130:2) and its dark twin (133:1207).

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { LIMITS } from '@kerf/shared';
import { api, liveStreamUrl, type ChatMessageJson, type LiveSessionJson, type ProjectJson } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { EmptyState } from '@/components/kerf/empty-state';
import { LiveCard } from '@/components/kerf/live-card';
import { PageHeader, Panel, SectionLabel } from '@/components/kerf/ui';
import { ArrowUpIcon, MessageCircleDashedIcon } from 'lucide-react';
import { Avatar } from '@/components/kerf/artwork';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';

function parseEvent<T>(e: MessageEvent): T | null {
  try {
    return JSON.parse(e.data) as T;
  } catch {
    return null;
  }
}

const FILTERS = ['All', 'People I follow', 'My projects'] as const;
type Filter = (typeof FILTERS)[number];

export default function LivePage() {
  const { auth, getToken } = useAuth();
  const [sessions, setSessions] = useState<Map<string, LiveSessionJson>>(new Map());
  const [messages, setMessages] = useState<ChatMessageJson[]>([]);
  const [projects, setProjects] = useState<ProjectJson[]>([]);
  const [watching, setWatching] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('All');
  const [body, setBody] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!auth) {
      setFollowing(new Set());
      return;
    }
    void getToken()
      .then((t) => (t ? api.myFollows(t).then((r) => setFollowing(new Set(r.following.map((f) => f.handle)))) : null))
      .catch(() => {});
  }, [auth, getToken]);
  useEffect(() => {
    api
      .liveSessions()
      .then((r) => setSessions(new Map(r.sessions.map((s) => [s.sessionId, s]))))
      .catch(() => {});
    api.chatHistory().then((r) => setMessages(r.messages)).catch(() => {});
    api.projects().then((r) => setProjects(r.projects)).catch(() => {});
    api.health().then((h) => setWatching(h.streams)).catch(() => {});

    const es = new EventSource(liveStreamUrl());
    es.addEventListener('session', (e) => {
      const s = parseEvent<LiveSessionJson>(e);
      if (!s) return;
      setSessions((prev) => new Map(prev).set(s.sessionId, s));
    });
    // A finished session just leaves. It used to move to an "ended in the last
    // hour" panel, which reported a duration reconstructed from the last beat
    // and no score — the points are only awarded when the session uploads.
    es.addEventListener('session-end', (e) => {
      const data = parseEvent<{ sessionId: string; handle: string }>(e);
      if (!data) return;
      setSessions((prev) => {
        const next = new Map(prev);
        next.delete(data.sessionId);
        return next;
      });
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
  const tiles =
    filter === 'My projects'
      ? all.filter((s) => s.projectId && myProjectIds.has(s.projectId))
      : filter === 'People I follow'
        ? all.filter((s) => following.has(s.handle))
        : all;

  return (
    // The PageHeader sits INSIDE the left column rather than above the grid, so
    // the chat starts level with it and owns the full right side. With the
    // header above, the panel's natural top was ~104px lower than where it
    // sticks, and the composer fell off the bottom of the fold.
    // items-start so the column can be sticky at all — a stretched grid item is
    // already full height and has nothing to stick to.
    <div className="grid grid-cols-[740fr_360fr] items-start gap-5">
      <div className="space-y-[26px]">
        <PageHeader
          title="Live"
          subtitle={`${all.length} session${all.length === 1 ? '' : 's'} beating right now.`}
        />
        <div>
          <div className="flex gap-[10px]">
            {FILTERS.map((f) => {
              // "People I follow" needs a signed-in viewer to mean anything —
              // present and inert while signed out rather than silently doing
              // nothing, same as every other auth-gated control in this app.
              const unavailable = f === 'People I follow' && !auth;
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  disabled={unavailable}
                  aria-disabled={unavailable}
                  onClick={() => !unavailable && setFilter(f)}
                  title={unavailable ? 'Sign in to follow people' : undefined}
                  className={`h-[34px] min-w-[120px] rounded-[17px] px-4 border border-border bg-card text-[14px] ${
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
              <LiveCard key={s.sessionId} session={s} projectName={projectName(s.projectId)} nowMs={nowMs} />
            ))}
          </div>
          {tiles.length === 0 && (
            <EmptyState illustration="live-activity" title="Nobody is live right now">
              A tile appears within 15 seconds of someone running{' '}
              <span className="font-mono">kerf live</span>.
            </EmptyState>
          )}
        </div>
      </div>

      {/* Full-height and sticky, like the rail on the other side. `top-[42px]`
            is the layout's own top inset, which is now also this column's
            natural top — so the panel neither jumps on first scroll nor
            overflows the fold. The room is the point of this screen; it should
            not scroll away while you read the tiles. */}
        <Panel className="sticky top-[42px] flex h-[calc(100svh-42px-24px)] min-h-[560px] flex-col">
          <SectionLabel>LIVE CHAT</SectionLabel>
          <p className="mt-[5px] text-[14px] leading-[18px] text-muted-foreground">
            {watching === null ? '—' : `${watching} watching`}
          </p>
          <hr className="mt-[13px] border-t border-border" />

          {/* The hand-rolled version scrolled to the bottom on every new
              message, which yanked the view out from under anyone reading back
              through the history. This follows the live edge only while you are
              already at it, and offers a jump button when you are not.
              `flex-1 min-h-0` is the height constraint the scroller needs —
              without min-h-0 a flex child refuses to shrink and the viewport
              grows instead of scrolling. */}
          <MessageScrollerProvider autoScroll defaultScrollPosition="end">
            <MessageScroller className="mt-[14px] min-h-0 flex-1">
              <MessageScrollerViewport>
                <MessageScrollerContent className="space-y-[14px] pr-1">
                  {messages.map((m) => {
                    const mine = m.handle === auth?.handle;
                    return (
                      // Every message is its own turn here — this is a room, not
                      // a two-party thread — so each one is an anchor.
                      <MessageScrollerItem key={m.id} messageId={m.id} scrollAnchor>
                        <Message align={mine ? 'end' : 'start'}>
                          <MessageAvatar>
                            <Avatar handle={m.handle} size={28} className="rounded-full" />
                          </MessageAvatar>
                          <MessageContent>
                            {!mine && (
                              <Link
                                href={`/people/${m.handle}`}
                                className="text-[13px] font-semibold text-foreground hover:underline"
                              >
                                @{m.handle}
                              </Link>
                            )}
                            {/* Your own messages take the accent, everyone
                                else's take the raised surface — the same way
                                every chat anyone has used already works. */}
                            <p
                              className={`max-w-[248px] rounded-[14px] px-[12px] py-[8px] text-[14px] leading-[19px] ${
                                mine
                                  ? 'rounded-br-[4px] bg-primary text-primary-foreground'
                                  : 'rounded-bl-[4px] bg-secondary text-foreground'
                              }`}
                            >
                              {m.body}
                            </p>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    );
                  })}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>

          {messages.length === 0 && (
            <Empty className="flex-1">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageCircleDashedIcon />
                </EmptyMedia>
                <EmptyTitle>Quiet in here</EmptyTitle>
                <EmptyDescription>
                  {auth ? 'Say something — everyone on Kerf sees it.' : 'Sign in to join the room.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          <form onSubmit={sendChat} className="mt-3">
            <InputGroup>
              <InputGroupInput
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={LIMITS.chatBody}
                disabled={!auth}
                aria-label="Message"
                placeholder={auth ? 'Say something…' : 'Sign in to chat'}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="submit"
                  variant="default"
                  size="icon-sm"
                  disabled={!auth || !body.trim()}
                  aria-label="Send"
                >
                  <ArrowUpIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {chatError && <p className="mt-1 text-[13px] text-destructive">{chatError}</p>}
          </form>
      </Panel>
    </div>
  );
}
