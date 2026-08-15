'use client';

// `kerf login` lands here. The dashboard renders behind, blurred, so the first
// thing anyone sees is the thing they are joining — not a bare form on an empty
// page. Three steps: Google, your profile, what Kerf reads (+ the code, if any).
//
// The code no longer arrives via `?code=` in the URL. `kerf login` prints a
// short userCode in the terminal and opens this page bare — the person reads
// the code off their own screen and types it into the field below. A link can
// carry a query parameter; it cannot make someone type six characters they
// never saw. See apps/backend/src/device-code.ts for the split this replaces
// (one secret that both identified and authorised the login, phishable by
// forwarding a `kerf login` link to a victim).

import { useEffect, useState, type FormEvent } from 'react';
import { SignInButton, useAuth as useClerkAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { LIMITS } from '@kerf/shared';
import { api, ApiError } from '@/lib/api';
import { Avatar } from '@/components/kerf/artwork';
import { Spinner } from '@/components/kerf/spinner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const OVERLAY = 'bg-background/70 supports-backdrop-filter:backdrop-blur-sm';
const USER_CODE_RE = /^[0-9A-HJ-NP-TV-Z]{4}-[0-9A-HJ-NP-TV-Z]{4}$/;

// Step 3. Plain language, no spec numbers — this is the one place someone
// decides whether to trust the thing, and §6 is easier to trust than to read.
const PRIVACY = [
  ['Leaves your machine', 'counts, timestamps, and hashes — turns, edits, how often an edit had to be redone.'],
  ['Never leaves', 'prompts, responses, file contents, file paths, and project names.'],
  ['Only when you say so', 'skills and projects publish one at a time, by name, when you run a publish command.'],
];

function slugifyHandle(guess: string): string {
  return guess
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.handle);
}

export function CliConnectClient() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const { user } = useUser();
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [hasProfile, setHasProfile] = useState(false);
  // Step 3 is its own screen so the privacy panel is read before the token is
  // minted, not after.
  const [step, setStep] = useState<'profile' | 'privacy'>('profile');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [userCodeInput, setUserCodeInput] = useState('');
  // Checked once the field is full-length, so an expired/claimed code is
  // reported before the click rather than only from the claim's own error.
  const [codeStatus, setCodeStatus] = useState<'unchecked' | 'checking' | 'ok' | 'dead'>('unchecked');

  async function tokenOrThrow() {
    const token = await getToken();
    if (!token) throw new Error('missing Clerk token');
    return token;
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void (async () => {
      try {
        const { profile } = await api.clerkMe(await tokenOrThrow());
        if (profile) {
          setHasProfile(true);
          setHandle(profile.handle);
          setDisplayName(profile.displayName);
          setAvatarUrl(profile.avatarUrl ?? '');
          setStep('privacy');
          return;
        }
      } catch {
        setHasProfile(false);
      }
      // No Kerf profile yet — prefill from Google and let them edit it.
      setHandle(slugifyHandle(user?.username ?? user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? ''));
      setDisplayName(user?.fullName ?? user?.firstName ?? '');
      setAvatarUrl(user?.imageUrl ?? '');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, user?.id]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.upsertClerkProfile(await tokenOrThrow(), {
        handle: hasProfile ? undefined : handle,
        displayName,
        avatarUrl: avatarUrl || undefined,
      });
      setHasProfile(true);
      setStep('privacy');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save your profile');
    } finally {
      setBusy(false);
    }
  }

  function onCodeChange(raw: string) {
    // Auto-uppercase and insert the dash once past the 4th character, so
    // pasting either "wdjbmjht" or "WDJB-MJHT" lands the same, and typing one
    // key at a time reformats correctly at every length in between — the
    // backend's normalizeUserCode (device-code.ts) only handles a COMPLETE
    // 8-char code, which mid-typing this isn't yet.
    const cleaned = raw
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')
      .slice(0, 8);
    setUserCodeInput(cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned);
    setCodeStatus('unchecked');
  }

  // Checks the code's liveness once it's full-length — the non-consuming
  // /status route, not the CLI's collection point, which would steal the
  // token from the CLI that is actually polling for it.
  useEffect(() => {
    if (!USER_CODE_RE.test(userCodeInput)) return;
    let live = true;
    setCodeStatus('checking');
    api
      .cliLoginStatus(userCodeInput)
      .then((s) => live && setCodeStatus(s.status === 'pending' ? 'ok' : 'dead'))
      .catch(() => live && setCodeStatus('dead'));
    return () => {
      live = false;
    };
  }, [userCodeInput]);

  async function finish() {
    setError(null);
    setBusy(true);
    try {
      // An empty field has nothing to authorise — same three steps, it just
      // ends on the dashboard instead of connecting a terminal.
      if (userCodeInput) await api.claimCliLogin(await tokenOrThrow(), userCodeInput);
      router.replace(userCodeInput ? '/me?cli=connected' : '/me');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? 'That code has expired — run `kerf login` again for a fresh one.'
          : err instanceof ApiError && err.status === 409
            ? 'That code was already used.'
            : err instanceof ApiError
              ? err.message
              : 'Failed to connect the CLI',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <Dialog open>
        <DialogContent showCloseButton={false} overlayClassName={OVERLAY}>
          <DialogHeader>
            <DialogTitle>Join Kerf</DialogTitle>
            <DialogDescription>
              Sign in to claim a handle and, if you ran <code>kerf login</code>, connect your terminal. Kerf
              never signs in to Claude for you.
            </DialogDescription>
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

  if (step === 'profile') {
    return (
      <Dialog open>
        <DialogContent showCloseButton={false} overlayClassName={OVERLAY}>
          <DialogHeader>
            <DialogTitle>Your profile</DialogTitle>
            <DialogDescription>The handle is the only name anyone sees. 3–32 chars, a–z 0–9 and dashes.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveProfile} className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Google's CDN; next/image would need the host allow-listed.
                <img src={avatarUrl} alt="" width={56} height={56} className="size-[56px] rounded-full object-cover" />
              ) : (
                <Avatar handle={handle} size={56} className="rounded-full" />
              )}
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input
                  id="avatarUrl"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  maxLength={LIMITS.avatarUrl}
                  placeholder="your Google picture by default"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="handle">Handle</Label>
              <Input
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                maxLength={LIMITS.handle}
                disabled={hasProfile}
                placeholder="ada"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
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
              {busy && <Spinner className="mr-2" />}
              {busy ? 'Saving…' : 'Continue'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open>
      <DialogContent showCloseButton={false} overlayClassName={OVERLAY}>
        <DialogHeader>
          <DialogTitle>What Kerf reads</DialogTitle>
          <DialogDescription>Signed in as @{handle}. This is the whole arrangement.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {PRIVACY.map(([title, detail]) => (
            <div key={title} className="rounded-[12px] border border-border p-3">
              <p className="text-[14px] font-medium text-foreground">{title}</p>
              <p className="mt-1 text-[14px] leading-[19px] text-muted-foreground">{detail}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="userCode">Code from your terminal (optional)</Label>
          <Input
            id="userCode"
            value={userCodeInput}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="XXXX-XXXX"
            className="font-mono uppercase"
            maxLength={9}
            autoComplete="off"
          />
          {codeStatus === 'dead' && (
            <p className="text-[13px] text-destructive">
              That code has expired or was already used — run <code>kerf login</code> again.
            </p>
          )}
          {codeStatus === 'ok' && <p className="text-[13px] text-muted-foreground">Ready to connect.</p>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setStep('profile')} disabled={busy}>
            Back
          </Button>
          <Button onClick={finish} disabled={busy || codeStatus === 'dead' || codeStatus === 'checking'}>
            {busy && <Spinner className="mr-2" />}
            {busy ? 'Connecting…' : userCodeInput ? 'Connect CLI' : 'Done'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
