'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, type MeSessions } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function InsightsPage() {
  const { auth, ready } = useAuth();
  const [data, setData] = useState<MeSessions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    api.mySessions(auth.token).then(setData).catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load'));
  }, [auth]);

  if (!ready) return null;

  if (!auth) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Connect your CLI to see insights</CardTitle>
          <CardDescription>Insights are computed only from your own sessions.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const qualifying = data.sessions.filter((s) => s.qualifies);
  const ratios = qualifying.map((s) => s.reworkRatio).filter((r): r is number => r !== null);
  const avg = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;

  const tips = new Map<string, string>();
  for (const s of data.sessions) for (const t of s.tips) tips.set(t.id, t.message);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Sessions parsed</CardDescription>
            <CardTitle>{data.sessions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Qualifying</CardDescription>
            <CardTitle>{qualifying.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Avg rework ratio</CardDescription>
            <CardTitle className="font-mono">{avg === null ? '—' : avg.toFixed(3)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tool usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(data.toolTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([tool, count]) => {
              const max = Math.max(...Object.values(data.toolTotals));
              return (
                <div key={tool} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 font-mono text-sm">{tool}</span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm text-muted-foreground">{count}</span>
                </div>
              );
            })}
          {Object.keys(data.toolTotals).length === 0 && <p className="text-sm text-muted-foreground">No tool usage yet.</p>}
        </CardContent>
      </Card>

      {tips.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tips</CardTitle>
            <CardDescription>Template tips, numeric trigger rules shown in mono.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {[...tips.entries()].map(([id, message]) => (
              <Card key={id}>
                <CardContent className="pt-6 text-sm">
                  <p className="mb-1 font-mono text-xs text-muted-foreground">{id}</p>
                  {message}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead className="text-right">Turns</TableHead>
                <TableHead className="text-right">Edits</TableHead>
                <TableHead className="text-right">Rework</TableHead>
                <TableHead className="text-right">Ratio</TableHead>
                <TableHead>Qualifies</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.sessions.map((s) => (
                <TableRow key={s.sessionId} className={s.qualifies ? '' : 'text-muted-foreground'}>
                  <TableCell>{new Date(s.startedMs).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{s.turns}</TableCell>
                  <TableCell className="text-right">{s.edits}</TableCell>
                  <TableCell className="text-right">{s.editsRework}</TableCell>
                  <TableCell className="text-right font-mono">{s.reworkRatio === null ? '—' : s.reworkRatio.toFixed(3)}</TableCell>
                  <TableCell>
                    <Badge variant={s.qualifies ? 'default' : 'outline'}>{s.qualifies ? 'yes' : 'no'}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
