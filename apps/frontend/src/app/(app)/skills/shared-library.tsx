'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { LIMITS } from '@kerf/shared';
import { api, ApiError, type SkillJson } from '@/lib/api';
import { toast } from 'sonner';
import { formatSkillLabel, searchNeedle } from '@kerf/shared';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { CommandBlock, CopyButton, Panel, SectionLabel } from '@/components/kerf/ui';
import { EmptyState } from '@/components/kerf/empty-state';
import { SkillSheet, type SkillSheetSubject } from '@/components/kerf/skill-sheet';
import { Spinner } from '@/components/kerf/spinner';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';

export function PublishForm({
  onPublished,
  open,
  onOpenChange,
}: {
  onPublished: (s: SkillJson) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { auth, getToken } = useAuth();
  const setOpen = onOpenChange;
  // Two ways in: paste it here, or let the CLI read it off your disk. The CLI
  // route is the better one — it fills name and description from the SKILL.md
  // frontmatter instead of asking you to retype them.
  const [mode, setMode] = useState<'cli' | 'manual'>('cli');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  // Chosen before the row exists, not flipped afterwards: publishing fans the
  // new skill out over SSE, so a create-then-hide would broadcast it first.
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!auth) return;
    setError(null);
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('not signed in');
      const skill = await api.createSkill(token, { name, description: description || undefined, content, isPublic });
      onPublished(skill);
      toast.success('Skill published', {
        description: isPublic
          ? `Anyone can install it with kerf skill install ${skill.slug}`
          : 'Only you can see it. Make it public from your account.',
      });
      setOpen(false);
      setName('');
      setDescription('');
      setContent('');
      setIsPublic(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to publish';
      setError(message);
      toast.error('Could not publish', { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Publish a skill</SheetTitle>
          {/* No longer an unconditional claim — a skill can be published private. */}
          <SheetDescription>
            Publish a skill to the shared library, or keep it to yourself. You choose below.
          </SheetDescription>
        </SheetHeader>
        <div className="flex gap-2 px-4">
          <Button variant={mode === 'cli' ? 'default' : 'outline'} size="sm" onClick={() => setMode('cli')}>
            Use the CLI
          </Button>
          <Button variant={mode === 'manual' ? 'default' : 'outline'} size="sm" onClick={() => setMode('manual')}>
            Enter manually
          </Button>
        </div>

        {mode === 'cli' ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            <p className="text-sm text-muted-foreground">
              Lists the skills in <span className="font-mono">~/.claude/skills</span>, then publishes the one you name.
              Name and description come from its frontmatter.
            </p>
            {/* The --private line keeps the CLI and this sheet agreeing about
                what is possible; without it the switch below looks web-only. */}
            <CommandBlock
              lines={[
                ['kerf skills'],
                ['kerf skills publish <slug>'],
                ['kerf skills publish <slug> --private', '# only you can see it'],
              ]}
            />
            <p className="text-xs text-muted-foreground">
              The first command makes no network call — it prints to your terminal only.
            </p>
          </div>
        ) : (
        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="space-y-1.5">
            <Label htmlFor="skill-name">Name</Label>
            <Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.skillName} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-description">Description</Label>
            <Input
              id="skill-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={LIMITS.skillDescription}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-content">SKILL.md content</Label>
            <Textarea
              id="skill-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={LIMITS.skillContent}
              rows={10}
              className="font-mono text-xs"
              required
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-[12px] border border-border px-4 py-3">
            <div className="min-w-0">
              <Label htmlFor="skill-public">{isPublic ? 'Public' : 'Private'}</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {isPublic
                  ? 'Listed in the shared library. Anyone can install it.'
                  : 'Only you can see it — it is absent from the library, not greyed out.'}
              </p>
            </div>
            <Switch
              id="skill-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              aria-label="Publish this skill publicly"
              className="mt-1 shrink-0"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button type="submit" disabled={busy}>
              {busy && <Spinner className="mr-2" />}
              {busy ? 'Publishing…' : 'Publish'}
            </Button>
          </SheetFooter>
        </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function SharedLibrary({
  initialSkills,
  publishOpen,
  onPublishOpenChange,
  query = '',
}: {
  initialSkills: SkillJson[];
  publishOpen: boolean;
  onPublishOpenChange: (open: boolean) => void;
  /** The page's one search box also narrows the library. */
  query?: string;
}) {
  const { auth, getToken } = useAuth();
  const [skills, setSkills] = useState(initialSkills);
  const [sort, setSort] = useState<'recent' | 'stars'>('recent');
  const [starred, setStarred] = useState<Set<string>>(
    () => new Set(initialSkills.filter((s) => s.isStarredByMe).map((s) => s.id)),
  );
  // The card already holds the whole row, so the sheet gets `entry` and makes
  // no request of its own.
  const [detail, setDetail] = useState<SkillSheetSubject | null>(null);

  useEffect(() => {
    // getToken(), not the auth.token snapshot: a Clerk JWT older than about a
    // minute resolves to no viewer, which drops the owner's own PRIVATE skills
    // out of the list and renders every star unstarred.
    void getToken()
      .catch(() => null)
      .then((t) => api.skillLibrary(sort, t ?? undefined))
      .then((res) => {
        setSkills(res.skills);
        setStarred(new Set(res.skills.filter((s) => s.isStarredByMe).map((s) => s.id)));
      })
      .catch(() => {});
  }, [sort, getToken]);

  async function toggleStar(id: string) {
    if (!auth) return;
    const token = await getToken();
    if (!token) return;
    try {
      const res = await api.toggleSkillStar(token, id);
      setStarred((prev) => {
        const next = new Set(prev);
        if (res.starred) next.add(id);
        else next.delete(id);
        return next;
      });
      setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, starCount: res.starCount } : s)));
      toast.success(res.starred ? 'Starred' : 'Star removed');
    } catch {
      toast.error('Could not update your star');
    }
  }

  const needle = searchNeedle(query);
  const shown = needle
    ? skills.filter((s) =>
        [s.name, s.description ?? '', s.handle].some((f) => f.toLowerCase().includes(needle)),
      )
    : skills;

  return (
    <>
      {/* Panel + SectionLabel like every other block on this page — this used
          to be a bare div with no title and no border, which read as loose
          cards after the page ended rather than a section. Content and sort
          were already fine; only the framing was missing. */}
      <Panel>
        <div className="flex items-center justify-between">
          <SectionLabel>SHARED LIBRARY</SectionLabel>
          <PublishForm
            open={publishOpen}
            onOpenChange={onPublishOpenChange}
            onPublished={(s) => {
              setSkills((prev) => [s, ...prev]);
              setStarred((prev) => {
                const next = new Set(prev);
                if (s.isStarredByMe) next.add(s.id);
                return next;
              });
            }}
          />
        </div>
        <div className="mt-[16px] flex gap-2">
          <Button variant={sort === 'recent' ? 'default' : 'outline'} size="sm" onClick={() => setSort('recent')}>
            Recent
          </Button>
          <Button variant={sort === 'stars' ? 'default' : 'outline'} size="sm" onClick={() => setSort('stars')}>
            Most starred
          </Button>
        </div>

        {shown.length === 0 &&
          (needle ? (
            <p className="mt-[16px] text-[15px] text-muted-foreground">No shared skill matches “{query.trim()}”.</p>
          ) : (
            <EmptyState illustration="publish-project" title="No skills shared yet" className="mt-[16px]">
              Publish one of your own and anyone can install it with the CLI.
            </EmptyState>
          ))}

        <div className="mt-[16px] grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => (
          <Card key={s.id} className="cursor-pointer" onClick={() => setDetail({ label: s.name, entry: s })}>
            <CardHeader>
              <CardTitle className="text-base">{formatSkillLabel(s.name)}</CardTitle>
              <CardDescription className="line-clamp-2">{s.description ?? 'No description.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>@{s.handle}</span>
                <Badge variant="secondary">{s.starCount} ★</Badge>
                <Badge variant="secondary">{s.installCount} installs</Badge>
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button variant={starred.has(s.id) ? 'default' : 'outline'} size="sm" onClick={() => toggleStar(s.id)}>
                          {starred.has(s.id) ? 'Starred' : 'Star'}
                        </Button>
                      }
                    />
                    {!auth && <TooltipContent>Connect on the Me page first</TooltipContent>}
                  </Tooltip>
                </TooltipProvider>
                <CopyButton text={s.content} label="Copy" />
                <CopyButton text={`kerf skill install ${s.slug}`} label="Install" />
              </div>
            </CardContent>
          </Card>
          ))}
        </div>
      </Panel>

      {detail && <SkillSheet subject={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
