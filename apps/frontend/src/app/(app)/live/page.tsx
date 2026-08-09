'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LIMITS } from '@kerf/shared';
import { api, liveStreamUrl, type ChatMessageJson, type LiveSessionJson } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function LiveTile({ s }: { s: LiveSessionJson }) {
  const pace = s.turns > 0 ? (s.edits / s.turns).toFixed(2) : '—';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <Link href={`/u/${s.handle}`} className="hover:underline">
            @{s.handle}
          </Link>
        </CardTitle>
        <CardDescription>{s.projectId ? 'published project' : 'private work'}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 font-mono text-sm">
        <span>turns {s.turns}</span>
        <span>edits {s.edits}</span>
        <span>rework {s.editsRework}</span>
        <span>ratio {s.reworkRatio === null ? '—' : s.reworkRatio.toFixed(3)}</span>
        <span className="col-span-2">pace (edits/turn) {pace}</span>
      </CardContent>
    </Card>
  );
}

export default function LivePage() {
  const { auth } = useAuth();
  const [sessions, setSessions] = useState<Map<string, LiveSessionJson>>(new Map());
  const [messages, setMessages] = useState<ChatMessageJson[]>([]);
  const [body, setBody] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.liveSessions().then((r) => setSessions(new Map(r.sessions.map((s) => [s.sessionId, s]))));
    api.chatHistory().then((r) => setMessages(r.messages));

    const es = new EventSource(liveStreamUrl());
    es.addEventListener('session', (e) => {
      const s = JSON.parse(e.data) as LiveSessionJson;
      setSessions((prev) => new Map(prev).set(s.sessionId, s));
    });
    es.addEventListener('session-end', (e) => {
      const s = JSON.parse(e.data) as { sessionId: string };
      setSessions((prev) => {
        const next = new Map(prev);
        next.delete(s.sessionId);
        return next;
      });
    });
    es.addEventListener('chat', (e) => {
      const m = JSON.parse(e.data) as ChatMessageJson;
      setMessages((prev) => [...prev.slice(-49), m]);
    });
    return () => es.close();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function sendChat(e: FormEvent) {
    e.preventDefault();
    if (!auth || !body.trim()) return;
    setChatError(null);
    try {
      await api.postChat(auth.token, body.trim());
      setBody('');
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to send');
    }
  }

  const tiles = [...sessions.values()].slice(0, 6);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {sessions.size} session{sessions.size === 1 ? '' : 's'} live now. Names only — arguments never leave your machine.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tiles.map((s) => (
            <LiveTile key={s.sessionId} s={s} />
          ))}
          {tiles.length === 0 && <p className="text-sm text-muted-foreground">No one is live right now.</p>}
        </div>
      </div>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
          <CardDescription>{LIMITS.chatBody} chars max · 5 messages per 10s · control chars stripped</CardDescription>
        </CardHeader>
        <CardContent ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: 400 }}>
          {messages.map((m) => (
            <p key={m.id} className="text-sm">
              <Link href={`/u/${m.handle}`} className="font-medium hover:underline">
                @{m.handle}
              </Link>{' '}
              {m.body}
            </p>
          ))}
          {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
        </CardContent>
        <CardContent className="pt-0">
          {auth ? (
            <form onSubmit={sendChat} className="flex gap-2">
              <Input value={body} onChange={(e) => setBody(e.target.value)} maxLength={LIMITS.chatBody} placeholder="Say something…" />
              <Button type="submit">Send</Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Connect your CLI on the Me page to chat.</p>
          )}
          {chatError && <p className="mt-2 text-sm text-destructive">{chatError}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
