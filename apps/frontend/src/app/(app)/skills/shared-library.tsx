'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { LIMITS } from '@kerf/shared';
import { api, ApiError, type SkillJson } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from '@/components/ui/sheet';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied!' : label}
    </Button>
  );
}

function PublishForm({ onPublished }: { onPublished: (s: SkillJson) => void }) {
  const { auth } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!auth) return;
    setError(null);
    setBusy(true);
    try {
      const skill = await api.createSkill(auth.token, { name, description: description || undefined, content });
      onPublished(skill);
      setOpen(false);
      setName('');
      setDescription('');
      setContent('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish');
    } finally {
      setBusy(false);
    }
  }

  const trigger = <Button>Publish a skill</Button>;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {auth ? (
        <SheetTrigger render={trigger} />
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={trigger} />
            <TooltipContent>Connect on the Me page first</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Publish a skill</SheetTitle>
          <SheetDescription>Shared with the whole league. Anyone can install it via the CLI.</SheetDescription>
        </SheetHeader>
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button type="submit" disabled={busy}>
              {busy ? 'Publishing…' : 'Publish'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SkillDetail({ skill, onClose }: { skill: SkillJson; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{skill.name}</SheetTitle>
          <SheetDescription>
            @{skill.handle} · {skill.starCount} stars · {skill.installCount} installs
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          {skill.description && <p className="mb-3 text-sm text-muted-foreground">{skill.description}</p>}
          <pre className="whitespace-pre-wrap rounded-md border bg-muted p-3 text-xs">{skill.content}</pre>
        </div>
        <SheetFooter className="flex-row gap-2">
          <CopyButton text={skill.content} label="Copy content" />
          <CopyButton text={`kerf skill install ${skill.slug}`} label="Copy install command" />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function SharedLibrary({ initialSkills }: { initialSkills: SkillJson[] }) {
  const { auth } = useAuth();
  const [skills, setSkills] = useState(initialSkills);
  const [sort, setSort] = useState<'recent' | 'stars'>('recent');
  const [starred, setStarred] = useState<Set<string>>(
    () => new Set(initialSkills.filter((s) => s.isStarredByMe).map((s) => s.id)),
  );
  const [detail, setDetail] = useState<SkillJson | null>(null);

  useEffect(() => {
    api.skillLibrary(sort, auth?.token).then((res) => {
      setSkills(res.skills);
      setStarred(new Set(res.skills.filter((s) => s.isStarredByMe).map((s) => s.id)));
    });
  }, [sort, auth?.token]);

  async function toggleStar(id: string) {
    if (!auth) return;
    const res = await api.toggleSkillStar(auth.token, id);
    setStarred((prev) => {
      const next = new Set(prev);
      if (res.starred) next.add(id);
      else next.delete(id);
      return next;
    });
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, starCount: res.starCount } : s)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant={sort === 'recent' ? 'default' : 'outline'} size="sm" onClick={() => setSort('recent')}>
            Recent
          </Button>
          <Button variant={sort === 'stars' ? 'default' : 'outline'} size="sm" onClick={() => setSort('stars')}>
            Most starred
          </Button>
        </div>
        <PublishForm
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

      {skills.length === 0 && <p className="text-sm text-muted-foreground">No skills shared yet — be the first.</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((s) => (
          <Card key={s.id} className="cursor-pointer" onClick={() => setDetail(s)}>
            <CardHeader>
              <CardTitle className="text-base">{s.name}</CardTitle>
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

      {detail && <SkillDetail skill={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
