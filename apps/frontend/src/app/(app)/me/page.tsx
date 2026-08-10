'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { LIMITS } from '@kerf/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

function ConnectFlow() {
  const { connect } = useAuth();
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.createProfile({ handle, displayName });
      setToken(res.token);
      connect({ handle: res.handle, token: res.token });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to claim handle');
    } finally {
      setBusy(false);
    }
  }

  if (token) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Connected as @{handle}</CardTitle>
          <CardDescription>Your token is shown once — copy it now. It cannot be shown again.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 font-mono text-sm">
          <p className="break-all rounded-md border bg-muted p-3">{token}</p>
          <p>$ kerf sync --token {token.slice(0, 8)}…</p>
          <p>$ kerf live --token {token.slice(0, 8)}…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Connect your CLI</CardTitle>
        <CardDescription>Claim a handle to get a CLI token. Shown once.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="handle">Handle</Label>
            <Input
              id="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              maxLength={LIMITS.handle}
              placeholder="ada"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={LIMITS.displayName}
              placeholder="Ada Lovelace"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? 'Claiming…' : 'Claim handle'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileSettings() {
  const { auth, disconnect } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [publicSkills, setPublicSkills] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    api.profile(auth.handle).then((p) => {
      setDisplayName(p.displayName);
      setBio(p.bio ?? '');
      setPublicSkills(p.publicSkills);
      setAvatarUrl(p.avatarUrl ?? '');
      setWebsiteUrl(p.websiteUrl ?? '');
      setGithubUrl(p.githubUrl ?? '');
      setXUrl(p.xUrl ?? '');
    });
  }, [auth]);

  async function save() {
    if (!auth) return;
    setError(null);
    setSaved(false);
    try {
      await api.updateMyProfile(auth.token, {
        displayName,
        bio: bio || undefined,
        publicSkills,
        avatarUrl: avatarUrl || undefined,
        websiteUrl: websiteUrl || undefined,
        githubUrl: githubUrl || undefined,
        xUrl: xUrl || undefined,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save');
    }
  }

  if (!auth) return null;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>@{auth.handle}</CardTitle>
        <CardDescription>Profile settings — visible on your public page.</CardDescription>
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
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Saved.</p>}
        <div className="flex gap-2">
          <Button onClick={save}>Save</Button>
          <Button variant="outline" onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MePage() {
  const { auth, ready } = useAuth();

  if (!ready) return null;

  return auth ? <ProfileSettings /> : <ConnectFlow />;
}
