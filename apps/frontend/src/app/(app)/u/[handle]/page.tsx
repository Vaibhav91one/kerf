import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ProfilePage({ params }: PageProps<'/u/[handle]'>) {
  const { handle } = await params;

  const profile = await api.profile(handle).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });

  if (!profile) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{profile.displayName}</CardTitle>
          <CardDescription>@{profile.handle}</CardDescription>
        </CardHeader>
        {profile.bio && <CardContent className="text-sm text-muted-foreground">{profile.bio}</CardContent>}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Tier</CardDescription>
            <CardTitle>{profile.standing.tier ?? '—'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Avg rework ratio</CardDescription>
            <CardTitle className="font-mono">
              {profile.standing.avgReworkRatio === null ? '—' : profile.standing.avgReworkRatio.toFixed(3)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Streak</CardDescription>
            <CardTitle>{profile.streak} days</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Qualifying sessions</CardDescription>
            <CardTitle>{profile.standing.sessionCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {profile.badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {profile.badges.map((b) => (
              <Badge key={b.id} variant={b.earned ? 'default' : 'outline'}>
                {b.label}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Skills &amp; tools</CardTitle>
          <CardDescription>
            {profile.publicSkills
              ? `Visible because @${profile.handle} turned on public skills. Off by default.`
              : `@${profile.handle} keeps skills private. Off by default.`}
          </CardDescription>
        </CardHeader>
        {profile.publicSkills && profile.skills && (
          <CardContent className="flex flex-wrap gap-2 font-mono text-sm">
            {Object.entries(profile.skills).map(([tool, count]) => (
              <span key={tool} className="rounded-md border px-2 py-1">
                {tool} · {count}
              </span>
            ))}
          </CardContent>
        )}
      </Card>

      {profile.projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {profile.projects.map((p) => (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  {p.description && <CardDescription>{p.description}</CardDescription>}
                </CardHeader>
                {p.repoUrl && (
                  <CardContent>
                    <Link href={p.repoUrl} className="text-sm text-primary hover:underline" target="_blank" rel="noreferrer">
                      {p.repoUrl}
                    </Link>
                  </CardContent>
                )}
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
