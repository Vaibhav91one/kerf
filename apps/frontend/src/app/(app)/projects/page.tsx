'use client';

// Screen `Light / 05 Projects` (130:510) and its dark twin (133:1643).

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LIMITS } from '@kerf/shared';
import { api, type LiveSessionJson, type ProjectJson } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ProjectsIcon } from '@/components/kerf/icons';
import { PageHeader, Panel, SectionLabel } from '@/components/kerf/ui';

function Field({
  label,
  hint,
  ...props
}: { label: string; hint: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-[11px] font-medium leading-[14px] text-foreground">{label}</label>
      <input
        {...props}
        className="mt-[7px] h-[36px] w-full rounded-[12px] border border-border bg-card px-[14px] text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
      />
      <p className="mt-[7px] text-[10px] leading-[13px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function ProjectsPage() {
  const { auth } = useAuth();
  const [projects, setProjects] = useState<ProjectJson[] | null>(null);
  const [live, setLive] = useState<LiveSessionJson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
      const created = await api.createProject(auth.token, {
        name: String(data.get('name') ?? ''),
        description: String(data.get('description') ?? '') || undefined,
        repoUrl: String(data.get('repoUrl') ?? '') || undefined,
      });
      setProjects((prev) => [created, ...(prev ?? [])]);
      formRef.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish');
    } finally {
      setBusy(false);
    }
  }

  if (!projects) return null;
  const liveFor = (id: string) => live.filter((s) => s.projectId === id).length;

  return (
    <div className="space-y-[28px]">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <PageHeader
            title="Projects"
            subtitle="Anything you publish here is something you typed and chose to show. Sessions attach to it by project hash."
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {projects.map((p) => {
          const liveCount = liveFor(p.id);
          return (
            <div key={p.id} className="relative h-[240px] rounded-[16px] border border-border bg-card p-5">
              <ProjectsIcon size={20} className="absolute right-5 top-5 text-muted-foreground" />
              <p className="text-[18px] font-semibold leading-[22px] text-foreground">{p.name}</p>
              <Link
                href={`/u/${p.handle}`}
                className="mt-[10px] block text-[12px] leading-[15px] text-muted-foreground hover:underline"
              >
                @{p.handle}
              </Link>
              <p className="mt-[13px] line-clamp-2 text-[13px] leading-[17px] text-muted-foreground">
                {p.description ?? 'private — name hidden by owner'}
              </p>
              <p className="absolute left-5 top-[136px] font-mono text-[12px] text-muted-foreground">
                {p.repoUrl ? (
                  <a href={p.repoUrl} target="_blank" rel="noreferrer" className="hover:underline">
                    {p.repoUrl.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  'not published'
                )}
              </p>
              <div className="absolute bottom-[30px] left-5 flex items-center gap-5">
                <span className="flex h-[28px] items-center rounded-[14px] border border-border px-[14px] text-[11px] font-medium text-foreground">
                  {liveCount > 0 ? `${liveCount} live` : 'idle'}
                </span>
                <span className="font-mono text-[12px] text-muted-foreground">{p.sessionCount ?? 0} sessions</span>
              </div>
            </div>
          );
        })}
        {projects.length === 0 && (
          <p className="text-[13px] text-muted-foreground">Nothing published yet.</p>
        )}
      </div>

      <div className="grid grid-cols-[640fr_440fr] gap-5">
        <Panel className="min-h-[290px]">
          <SectionLabel>NEW PROJECT</SectionLabel>
          {auth ? (
            <form ref={formRef} onSubmit={create} className="mt-[16px] space-y-[11px]">
              <Field label="Name" hint={`${LIMITS.projectName} chars`} name="name" maxLength={LIMITS.projectName} required placeholder="kerf" />
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
              {error && <p className="text-[11px] text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="h-[40px] w-[160px] rounded-[12px] bg-primary text-[13px] font-medium text-primary-foreground disabled:opacity-60"
              >
                {busy ? 'Publishing…' : 'New project'}
              </button>
            </form>
          ) : (
            <p className="mt-[16px] text-[13px] text-muted-foreground">
              Sign in on <Link href="/me" className="underline">/me</Link> to publish a project.
            </p>
          )}
        </Panel>

        <Panel className="min-h-[290px]">
          <SectionLabel>WHAT LINKS A SESSION TO A PROJECT</SectionLabel>
          <p className="mt-[18px] font-mono text-[14px] leading-[18px] text-muted-foreground">projectHash</p>
          <p className="mt-[8px] font-mono text-[12px] leading-[15px] text-muted-foreground">
            a1f4c9…&nbsp;&nbsp;(sha256 of the local path)
          </p>
          <p className="mt-[16px] max-w-[400px] text-[13px] leading-[17px] text-muted-foreground">
            The hash is computed on your machine and matched server-side. The path itself is never sent, so a private
            repo stays a row of numbers with no name attached.
          </p>
          <p className="mt-[22px] max-w-[400px] text-[11px] leading-[14px] text-muted-foreground">
            Unmatched hashes simply show as &ldquo;private project&rdquo;.
          </p>
        </Panel>
      </div>

      <Panel className="min-h-[90px]">
        <p className="max-w-[1000px] text-[13px] leading-[17px] text-muted-foreground">
          Kerf itself is open source and built in public — this project card is the same shape as everyone else&apos;s.
        </p>
      </Panel>
    </div>
  );
}
