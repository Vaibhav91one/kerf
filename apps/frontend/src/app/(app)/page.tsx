'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError, type LiveSessionJson, type MeSessions, type SeasonCurrent } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const TIER_CUTS = ['p20', 'p50', 'p80', 'p95'] as const;

export default function HomePage() {
  const { auth } = useAuth();
  const [season, setSeason] = useState<SeasonCurrent | null>(null);
  const [live, setLive] = useState<LiveSessionJson[] | null>(null);
  const [me, setMe] = useState<MeSessions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.seasonCurrent().then(setSeason).catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load season'));
    api.liveSessions().then((r) => setLive(r.sessions)).catch(() => setLive([]));
  }, []);

  useEffect(() => {
    if (!auth) return;
    api.mySessions(auth.token).then(setMe).catch(() => setMe(null));
  }, [auth]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!season) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (season.sampleSize === 0) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>No sessions yet this season</CardTitle>
          <CardDescription>
            Explore Kerf publicly, then sign in with Google when you want to publish your own profile, live sessions, projects, or skills.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-md border bg-muted/40 p-3 font-mono text-sm">
            <p>$ kerf login</p>
            <p>$ kerf sync</p>
            <p>$ kerf live</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button render={<Link href="/me" />}>{auth ? 'Open profile' : 'Sign in when ready'}</Button>
            <Button variant="outline" render={<Link href="/live" />}>
              Explore live feed
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Season metric</CardDescription>
            <CardTitle>Rework ratio</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Lower is better · Tier A</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Qualifying sessions</CardDescription>
            <CardTitle>{season.sampleSize}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Live now</CardDescription>
            <CardTitle>{live === null ? '—' : live.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tier ladder</CardTitle>
          <CardDescription>Rework ratio cuts — lower is better</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 font-mono text-sm">
          {TIER_CUTS.map((k) => (
            <span key={k} className="rounded-md border px-3 py-1">
              {k} = {season.cuts[k].toFixed(3)}
            </span>
          ))}
        </CardContent>
      </Card>

      {live && live.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Live now</CardTitle>
            <CardDescription>Names only. Arguments never leave your machine.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {live.map((s) => (
              <Link key={s.sessionId} href={`/u/${s.handle}`}>
                <Badge variant="secondary" className="font-mono">
                  @{s.handle} · {s.turns}t / {s.edits}e
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {me && me.badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your badges</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {me.badges.map((b) => (
              <Badge key={b.id} variant={b.earned ? 'default' : 'outline'}>
                {b.label}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Handle</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Avg rework ratio</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {season.standings.map((s) => (
                <TableRow key={s.handle}>
                  <TableCell>
                    <Link href={`/u/${s.handle}`} className="font-medium hover:underline">
                      @{s.handle}
                    </Link>
                  </TableCell>
                  <TableCell>{s.tier ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono">{s.avgReworkRatio.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{s.sessionCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
