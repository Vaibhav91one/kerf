import Link from 'next/link';
import { api } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default async function PeoplePage() {
  const { profiles } = await api.profiles();

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
          <CardDescription>Profiles are the public user pages: skills, projects, stats, badges, and build-in-public activity.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {profiles.map((profile) => (
          <Link key={profile.handle} href={`/people/${profile.handle}`}>
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader className="flex flex-row items-center gap-3">
                <Avatar className="size-11">
                  {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt="" />}
                  <AvatarFallback>{initials(profile.displayName) || profile.handle.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{profile.displayName}</CardTitle>
                  <CardDescription className="truncate">@{profile.handle}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {profile.bio && <p className="line-clamp-2 text-sm text-muted-foreground">{profile.bio}</p>}
                <div className="flex flex-wrap gap-2">
                  <Badge variant={profile.publicSkills ? 'default' : 'secondary'}>
                    {profile.publicSkills ? 'Public skills' : 'Private skills'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
