'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { SignInButton, useAuth as useClerkAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { LIMITS } from '@kerf/shared';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Missing CLI code</DialogTitle>
            <DialogDescription>Run `kerf login` again to generate a fresh connection link.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Connect Kerf CLI</DialogTitle>
            <DialogDescription>Sign in with Google, then this browser session will authorize your terminal.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <SignInButton mode="modal">
              <Button>Continue with Google</Button>
            </SignInButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!hasProfile) {
    return (
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Claim your Kerf handle</DialogTitle>
            <DialogDescription>This handle owns the CLI token that will be stored by `kerf login`.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createProfile} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="handle">Handle</Label>
              <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={LIMITS.handle} placeholder="ada" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={LIMITS.displayName} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? 'Connecting…' : 'Claim and connect CLI'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Authorize this CLI?</DialogTitle>
          <DialogDescription>Signed in as @{handle}. This creates a Kerf CLI token for `sync` and `live`.</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button onClick={claim} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect CLI'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
