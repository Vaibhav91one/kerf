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

  const { skills: allSkills } = await api.skillLibrary();
  const publishedSkills = allSkills.filter((s) => s.handle === profile.handle);

  const socialLinks = [
    { label: 'Website', url: profile.websiteUrl },
    { label: 'GitHub', url: profile.githubUrl },
    { label: 'X', url: profile.xUrl },
  ].filter((l): l is { label: string; url: string } => Boolean(l.url));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          {profile.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="" className="h-14 w-14 rounded-full border object-cover" />
          )}
          <div>
            <CardTitle>{profile.displayName}</CardTitle>
            <CardDescription>@{profile.handle}</CardDescription>
          </div>
        </CardHeader>
        {(profile.bio || socialLinks.length > 0) && (
          <CardContent className="space-y-2">
            {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
            {socialLinks.length > 0 && (
              <div className="flex gap-3 text-sm">
                {socialLinks.map((l) => (
                  <Link key={l.label} href={l.url} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        )}
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

      {publishedSkills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Skills published</CardTitle>
            <CardDescription>Shared with the league — see the Shared Library tab on Skills to install.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {publishedSkills.map((s) => (
              <Card key={s.id}>
                <CardHeader>
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  {s.description && <CardDescription>{s.description}</CardDescription>}
                </CardHeader>
                <CardContent className="flex gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{s.starCount} ★</Badge>
                  <Badge variant="secondary">{s.installCount} installs</Badge>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
