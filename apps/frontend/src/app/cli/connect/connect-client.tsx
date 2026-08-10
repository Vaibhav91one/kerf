'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { SignInButton, useAuth as useClerkAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { LIMITS } from '@kerf/shared';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CliConnectClient({ code }: { code: string }) {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const { user } = useUser();
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState(user?.fullName ?? user?.firstName ?? '');
  const [hasProfile, setHasProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function tokenOrThrow() {
    const token = await getToken();
    if (!token) throw new Error('missing Clerk token');
    return token;
  }

  async function refreshProfile() {
    if (!isLoaded || !isSignedIn) return;
    try {
      const token = await tokenOrThrow();
      const { profile } = await api.clerkMe(token);
      setHasProfile(Boolean(profile));
      if (profile) {
        setHandle(profile.handle);
        setDisplayName(profile.displayName);
      }
    } catch {
      setHasProfile(false);
    }
  }

  async function claim() {
    setError(null);
    setBusy(true);
    try {
      const token = await tokenOrThrow();
      await api.claimCliLogin(token, code);
      router.replace('/me?cli=connected');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to connect CLI');
    } finally {
      setBusy(false);
    }
  }

  async function createProfile(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const token = await tokenOrThrow();
      await api.upsertClerkProfile(token, { handle, displayName });
      setHasProfile(true);
      await claim();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to claim profile');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, user?.id]);

  if (!code) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Missing CLI code</CardTitle>
          <CardDescription>Run `kerf login` again to generate a fresh connection link.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Connect Kerf CLI</CardTitle>
          <CardDescription>Sign in with Google, then this browser session will authorize your terminal.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInButton mode="modal">
            <Button>Continue with Google</Button>
          </SignInButton>
        </CardContent>
      </Card>
    );
  }

  if (!hasProfile) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Claim your Kerf handle</CardTitle>
          <CardDescription>This handle owns the CLI token that will be stored by `kerf login`.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="handle">Handle</Label>
              <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={LIMITS.handle} placeholder="ada" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={LIMITS.displayName} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? 'Connecting…' : 'Claim and connect CLI'}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Authorize this CLI?</CardTitle>
        <CardDescription>Signed in as @{handle}. This creates a Kerf CLI token for `sync` and `live`.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={claim} disabled={busy}>
          {busy ? 'Connecting…' : 'Connect CLI'}
        </Button>
      </CardContent>
    </Card>
  );
}
