'use client';

// Screen `Light / 05 Projects` (130:510) and its dark twin (133:1643).

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LIMITS, searchNeedle } from '@kerf/shared';
import { api, type LiveSessionJson, type ProjectJson } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { SignInButton } from '@clerk/nextjs';
import { Avatar, Illustration } from '@/components/kerf/artwork';
import { EmptyState } from '@/components/kerf/empty-state';
import { GithubIcon, ProjectsIcon } from '@/components/kerf/icons';
import { SearchBox } from '@/components/kerf/search-box';
import { PageHeader, PageSkeleton } from '@/components/kerf/ui';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

function Field({
  label,
  hint,
  ...props
}: { label: string; hint: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      {/* Nested, not a sibling with a separate id: the input is generated per
          call site with no stable id to match a `for`, and nesting gives the
          same click-focuses-input behaviour without inventing one. */}
      <label className="block text-[13px] font-medium leading-[17px] text-foreground">
        {label}
        <input
          {...props}
          className="mt-[7px] h-[36px] w-full rounded-[12px] border border-border bg-card px-[14px] text-[14px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
      </label>
      <p className="mt-[7px] text-[12px] leading-[16px] text-muted-foreground">{hint}</p>
    </div>
  );
}

// Props MUST be forwarded: Base UI's `render` prop passes the trigger's
// onClick/aria/ref through this component, so swallowing them silently makes
// the button inert.
function NewProjectButton(props: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      className="flex h-[40px] shrink-0 items-center gap-2 rounded-[12px] bg-primary px-5 text-[15px] font-medium text-primary-foreground"
    >
      <ProjectsIcon size={16} />
      New project
    </button>
  );
}

export default function ProjectsPage() {
  const { auth, signedIn, clerkEnabled, getToken } = useAuth();
  const [projects, setProjects] = useState<ProjectJson[] | null>(null);
  const [live, setLive] = useState<LiveSessionJson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // The form is uncontrolled (FormData) and Base UI's Switch emits no native
  // form value, so this one field is state. Reworking the whole form to
  // controlled inputs for one boolean is the larger change, not the smaller.
  const [isPublic, setIsPublic] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    api.projects().then((r) => setProjects(r.projects)).catch(() => setProjects([]));
    api.liveSessions().then((r) => setLive(r.sessions)).catch(() => {});
  }, []);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!auth) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('not signed in');
      const created = await api.createProject(token, {
        name: String(data.get('name') ?? ''),
        description: String(data.get('description') ?? '') || undefined,
        repoUrl: String(data.get('repoUrl') ?? '') || undefined,
        logoUrl: String(data.get('logoUrl') ?? '') || undefined,
        // Chosen at create time, not flipped afterwards: the SSE broadcast fires
        // the moment the row is created.
        isPublic,
      });
      setProjects((prev) => [created, ...(prev ?? [])]);
      formRef.current?.reset();
      setIsPublic(true);
      setOpen(false);
      toast.success('Project published', { description: created.name });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not publish';
      setError(message);
      toast.error('Could not publish', { description: message });
    } finally {
      setBusy(false);
    }
  }

  if (!projects) return <PageSkeleton />;
  const liveFor = (id: string) => live.filter((s) => s.projectId === id).length;

  // Owner handle is in the field set on purpose — "show me ada's projects" is
  // the second thing anyone types here. No Enter action: two people may both
  // name a project `kerf`, so there is nothing unique to jump to.
  const needle = searchNeedle(query);
  const shown = needle
    ? projects.filter((p) =>
        [p.name, p.description ?? '', p.handle].some((f) => f.toLowerCase().includes(needle)),
      )
    : projects;

  return (
    <div className="space-y-[28px]">
      <PageHeader
        title="Projects"
        subtitle="Sessions attach to a project by hash."
        action={
          // Never disabled — signed out it opens sign-in, which is what someone
          // clicking "New project" actually wants.
          <Dialog open={open} onOpenChange={setOpen}>
            {auth ? (
              <DialogTrigger render={<NewProjectButton />} />
            ) : signedIn || !clerkEnabled ? (
              <Link href="/me">
                <NewProjectButton />
              </Link>
            ) : (
              <SignInButton mode="modal">
                <NewProjectButton />
              </SignInButton>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New project</DialogTitle>
                <DialogDescription>
                  Sessions attach by hash once the name matches a folder you work in.
                </DialogDescription>
              </DialogHeader>
              <form ref={formRef} onSubmit={create} className="space-y-[11px] px-4">
                <Field
                  label="Name"
                  hint={`${LIMITS.projectName} chars`}
                  name="name"
                  maxLength={LIMITS.projectName}
                  required
                  placeholder="kerf"
                />
                <Field
                  label="Description"
                  hint={`${LIMITS.projectDescription} chars`}
                  name="description"
                  maxLength={LIMITS.projectDescription}
                  placeholder="competitive league for coding-agent CLI users"
                />
                <Field
                  label="Repo URL"
                  hint="http(s) only, no embedded credentials"
                  name="repoUrl"
                  type="url"
                  maxLength={LIMITS.repoUrl}
                  placeholder="https://github.com/ada/kerf"
                />
                <Field
                  label="Logo URL"
                  hint="optional — an illustration stands in when there is none"
                  name="logoUrl"
                  type="url"
                  maxLength={LIMITS.logoUrl}
                  placeholder="https://…/logo.svg"
                />
                <div className="flex items-center justify-between gap-4 pt-[4px]">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium leading-[17px] text-foreground">
                      {isPublic ? 'Public' : 'Private'}
                    </p>
                    <p className="mt-[7px] text-[12px] leading-[16px] text-muted-foreground">
                      Private keeps it off /projects and off the live feed. Only you can see it.
                    </p>
                  </div>
                  <Switch
                    size="sm"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                    aria-label="Publish this project publicly"
                    className="shrink-0"
                  />
                </div>
                {error && <p className="text-[13px] text-destructive">{error}</p>}
                <DialogFooter className="px-0">
                  <DialogClose
                    render={
                      <button
                        type="button"
                        className="h-[40px] rounded-[12px] border border-border px-5 text-[15px] text-muted-foreground"
                      >
                        Cancel
                      </button>
                    }
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="h-[40px] rounded-[12px] bg-primary px-6 text-[15px] font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {busy ? 'Publishing…' : 'Publish'}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search projects, descriptions or @handle"
        label="Search projects"
        count={shown.length}
      />

      <div className="grid grid-cols-2 gap-5">
        {shown.map((p) => {
          const liveCount = liveFor(p.id);
          return (
            // Two columns: text left, art right. The art panel is a real
            // column at full card height, not a decoration pinned to a corner —
            // and nothing is positioned absolutely, so growing text pushes the
            // card down instead of colliding with a hardcoded offset.
            // Stretched link: the whole card navigates, but the card is not
            // wrapped in an anchor — it already contains an <a> to the repo and
            // a <Link> to the owner, and nested anchors are invalid HTML that
            // browsers silently un-nest. The title's ::after claims the whole
            // surface; the inner links sit above it on z-10.
            <div
              key={p.id}
              className="relative flex min-h-[240px] overflow-hidden rounded-[16px] border border-border bg-card transition-colors hover:border-primary"
            >
              <div className="flex min-w-0 flex-1 flex-col p-5">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/projects/${p.id}`}
                    className="min-w-0 truncate text-[21px] font-semibold leading-[26px] text-foreground after:absolute after:inset-0 after:content-['']"
                  >
                    {p.name}
                  </Link>
                  {p.repoUrl && (
                    <a
                      href={p.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${p.name} repository`}
                      className="relative z-10 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <GithubIcon size={20} />
                    </a>
                  )}
                </div>
                <Link
                  href={`/people/${p.handle}`}
                  className="relative z-10 mt-[10px] flex w-fit items-center gap-2 text-[14px] leading-[18px] text-muted-foreground hover:text-foreground"
                >
                  <Avatar handle={p.handle} size={24} className="shrink-0 rounded-full" />
                  <span className="truncate">@{p.handle}</span>
                </Link>
                <p className="mt-[13px] line-clamp-3 text-[15px] leading-[20px] text-muted-foreground">
                  {/* This renders on a PUBLISHED project that has no
                      description — the old "private — name hidden by owner"
                      was simply false, and "private" now means the switch. */}
                  {p.description ?? 'No description.'}
                </p>
                <div className="mt-auto flex items-center gap-4 pt-[18px]">
                  <span className="flex h-[28px] shrink-0 items-center rounded-[14px] border border-border px-[14px] text-[13px] font-medium text-foreground">
                    {liveCount > 0 ? `${liveCount} live` : 'idle'}
                  </span>
                  <span className="shrink-0 font-mono text-[14px] text-muted-foreground">
                    {p.sessionCount ?? 0} sessions
                  </span>
                </div>
              </div>
              <div className="flex w-[42%] shrink-0 items-center justify-center self-stretch p-4">
                {p.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a remote logo on an arbitrary host; next/image would need every host allow-listed.
                  <img src={p.logoUrl} alt="" className="size-full max-h-[150px] object-contain" />
                ) : (
                  <Illustration name="project-fallback" width={200} className="h-auto w-full" />
                )}
              </div>
            </div>
          );
        })}
        {shown.length === 0 &&
          (needle ? (
            <EmptyState illustration="publish-project" title="No projects match" className="col-span-2">
              Nothing published matches “{query.trim()}” — not a name, a description, or an owner.
            </EmptyState>
          ) : (
            <EmptyState illustration="publish-project" title="Nothing published yet" className="col-span-2">
              A project links your sessions to a name. Publish one here or with{' '}
              <span className="font-mono">kerf projects publish</span>.
            </EmptyState>
          ))}
      </div>

    </div>
  );
}
