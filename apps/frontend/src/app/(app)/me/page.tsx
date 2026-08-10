'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { SignInButton, SignOutButton, UserButton, useAuth as useClerkAuth, useUser } from '@clerk/nextjs';
import { LIMITS } from '@kerf/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

function SignedOutState() {
  const { clerkEnabled } = useAuth();
  if (!clerkEnabled) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Clerk is not configured</CardTitle>
          <CardDescription>Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to enable Google login.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Sign in with Google</CardTitle>
        <CardDescription>Clerk owns dashboard auth. Kerf will mint a separate CLI token when you run `kerf login`.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInButton mode="modal">
          <Button>Continue with Google</Button>
        </SignInButton>
      </CardContent>
    </Card>
  );
}

function ClaimProfile() {
  const clerk = useClerkAuth();
  const { user } = useUser();
  const { refresh } = useAuth();
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const guess = user?.username ?? user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? '';
    setHandle(guess.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, LIMITS.handle));
    setDisplayName(user?.fullName ?? user?.firstName ?? '');
  }, [user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const token = await clerk.getToken();
      if (!token) throw new Error('missing Clerk session token');
      await api.saveClerkProfile(token, { handle, displayName });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to claim profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Claim your Kerf profile</CardTitle>
        <CardDescription>This links your Google sign-in to a public Kerf handle. The CLI connects separately with `kerf login`.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="handle">Handle</Label>
            <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={LIMITS.handle} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={LIMITS.displayName}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? 'Claiming…' : 'Claim profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileSettings() {
  const { auth, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(auth?.profile.displayName ?? '');
  const [bio, setBio] = useState(auth?.profile.bio ?? '');
  const [publicSkills, setPublicSkills] = useState(auth?.profile.publicSkills ?? false);
  const [avatarUrl, setAvatarUrl] = useState(auth?.profile.avatarUrl ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(auth?.profile.websiteUrl ?? '');
  const [githubUrl, setGithubUrl] = useState(auth?.profile.githubUrl ?? '');
  const [xUrl, setXUrl] = useState(auth?.profile.xUrl ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    setDisplayName(auth.profile.displayName);
    setBio(auth.profile.bio ?? '');
    setPublicSkills(auth.profile.publicSkills);
    setAvatarUrl(auth.profile.avatarUrl ?? '');
    setWebsiteUrl(auth.profile.websiteUrl ?? '');
    setGithubUrl(auth.profile.githubUrl ?? '');
    setXUrl(auth.profile.xUrl ?? '');
  }, [auth]);

  async function save() {
    if (!auth) return;
    setError(null);
    setSaved(false);
    try {
      await api.saveClerkProfile(auth.token, {
        displayName,
        bio: bio || undefined,
        publicSkills,
        avatarUrl: avatarUrl || undefined,
        websiteUrl: websiteUrl || undefined,
        githubUrl: githubUrl || undefined,
        xUrl: xUrl || undefined,
      });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save');
    }
  }

  if (!auth) return null;

  return (
    <Card className="max-w-xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>@{auth.handle}</CardTitle>
          <CardDescription>Profile settings — visible on your public page.</CardDescription>
        </div>
        <UserButton />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={LIMITS.displayName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={LIMITS.bio} rows={3} />
        </div>
        <div className="flex items-center gap-3">
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full border object-cover" />
          )}
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="avatarUrl">Avatar URL</Label>
            <Input id="avatarUrl" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} maxLength={LIMITS.avatarUrl} placeholder="https://…" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="websiteUrl">Website</Label>
            <Input id="websiteUrl" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} maxLength={LIMITS.socialUrl} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="githubUrl">GitHub</Label>
            <Input id="githubUrl" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} maxLength={LIMITS.socialUrl} placeholder="https://github.com/…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="xUrl">X</Label>
            <Input id="xUrl" value={xUrl} onChange={(e) => setXUrl(e.target.value)} maxLength={LIMITS.socialUrl} placeholder="https://x.com/…" />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Public skills</p>
            <p className="text-xs text-muted-foreground">Show which tools you use. Names only — arguments never leave your machine.</p>
          </div>
          <Switch checked={publicSkills} onCheckedChange={setPublicSkills} />
        </div>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">CLI login</p>
          <p className="text-muted-foreground">Run <code className="font-mono">kerf login</code>. It opens a Clerk-backed connect page and stores a Kerf CLI token locally.</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Saved.</p>}
        <div className="flex gap-2">
          <Button onClick={save}>Save</Button>
          <SignOutButton>
            <Button variant="outline">Sign out</Button>
          </SignOutButton>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MePage() {
  const { auth, ready, signedIn } = useAuth();

  if (!ready) return null;
  if (!signedIn) return <SignedOutState />;
  return auth ? <ProfileSettings /> : <ClaimProfile />;
}
