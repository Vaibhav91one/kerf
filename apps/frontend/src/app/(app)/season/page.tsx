import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const TIER_CUTS = ['p20', 'p50', 'p80', 'p95'] as const;

export default async function SeasonPage() {
  const season = await api.seasonCurrent();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tier cuts</CardTitle>
          <CardDescription>Rework ratio, current calendar month · lower is better</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 font-mono text-sm">
          {TIER_CUTS.map((k) => (
            <span key={k} className="rounded-md border px-3 py-1">
              {k} = {season.cuts[k].toFixed(3)}
            </span>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
          <CardDescription>{season.sampleSize} qualifying sessions this season</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Handle</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Avg rework ratio</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {season.standings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No qualifying sessions yet this season.
                  </TableCell>
                </TableRow>
              )}
              {season.standings.map((s, i) => (
                <TableRow key={s.handle}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <Link href={`/people/${s.handle}`} className="font-medium hover:underline">
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
