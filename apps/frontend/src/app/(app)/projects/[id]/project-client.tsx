'use client';

// One project: a hero that says whose it is, then tabs for whatever the project
// actually has. The GitHub panel is fetched separately from the project itself
// on purpose — it is a third-party call that can be slow, rate-limited or down,
// and the page must render fully without it.
//
// `id` arrives as a plain prop from page.tsx's server component, which
// already resolved params once for generateMetadata.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError, type ProjectActivity, type ProjectDetail, type RepoJson } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRefresh } from '@/hooks/use-refresh';
import { Avatar, Illustration } from '@/components/kerf/artwork';
import { GithubIcon } from '@/components/kerf/icons';
import { ActivityChart, LanguagePie } from '@/components/kerf/project-charts';
import { LoadingRow } from '@/components/kerf/spinner';
import { PageSkeleton, Panel, SectionLabel } from '@/components/kerf/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ago, formatDate } from '@/lib/time';

/** What the GitHub panel is doing. `absent` is the ordinary case, not an error. */
type RepoState =
  | { kind: 'loading' }
  | { kind: 'ready'; repo: RepoJson }
  | { kind: 'absent' }
  | { kind: 'limited' }
  | { kind: 'unreachable' };

export function ProjectClient({ id }: { id: string }) {
  const { getToken, ready } = useAuth();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [missing, setMissing] = useState(false);
  // Distinct from `missing`: a 404 means no such project, anything else means
  // we could not find out. Without this the page holds a skeleton forever.
  const [failed, setFailed] = useState(false);
  const [repo, setRepo] = useState<RepoState>({ kind: 'loading' });
  const [activity, setActivity] = useState<ProjectActivity | null>(null);
  // Only the clock: this page's data is third-party repo facts behind a
  // 10-minute server cache, so refetching it on a 30s tick would just spend
  // requests to read the same body back.
  const { nowMs } = useRefresh();

  useEffect(() => {
    // Wait for auth to hydrate first. Firing on mount fetches with a null token,
    // 404s on the owner's own private project, and latches `missing` — which
    // the render checks before anything else, so the later authenticated
    // response can never undo it.
    if (!ready) return;
    setMissing(false);
    setFailed(false);
    // All three routes narrow on `visibleTo(viewer)`, so without a bearer the
    // owner's own PRIVATE project reads as "No project here" — the backend's
    // owner branch is simply unreachable from an anonymous fetch.
    void getToken()
      .catch(() => null)
      .then((t) => {
        const token = t ?? undefined;
        api
          .project(id, token)
          .then(setProject)
          .catch((e) => {
            // Anything that is not a clean 404 is a failure, not an absence:
            // without this the page holds a skeleton forever on a 500.
            if (e instanceof ApiError && e.status === 404) setMissing(true);
            else setFailed(true);
          });
        api
          .projectGithub(id, token)
          .then((r) => setRepo({ kind: 'ready', repo: r }))
          .catch((e) => {
            if (e instanceof ApiError && e.status === 404) setRepo({ kind: 'absent' });
            else if (e instanceof ApiError && e.status === 503) setRepo({ kind: 'limited' });
            else setRepo({ kind: 'unreachable' });
          });
        api.projectActivity(id, token).then(setActivity).catch(() => setActivity(null));
      });
  }, [id, ready, getToken]);

  if (missing) return <p className="text-[16px] text-muted-foreground">No project here.</p>;
  // Not the visitor's fault, and distinct from "no project here" — saying the
  // project is gone when the request merely failed would be a lie.
  if (failed) return <p className="text-[16px] text-muted-foreground">Could not load this project. Try again.</p>;
  if (!project) return <PageSkeleton />;

  // Tabs only exist for what the project has — an empty project should show one
  // tab, not three dead ones.
  const hasActivity = project.sessionCount > 0 && activity !== null;
  // `loading` keeps the tab present so it does not pop in after the fetch.
  const hasRepo = repo.kind !== 'absent';

  return (
    <div className="space-y-[28px]">
      <Panel className="flex items-start gap-5 px-[22px] py-[22px]">
        <div className="flex min-w-0 flex-1 gap-5">
          {project.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a remote logo on an arbitrary host; next/image would need every host allow-listed.
            <img src={project.logoUrl} alt="" className="size-[72px] shrink-0 rounded-[16px] object-contain" />
          ) : (
            <Illustration name="project-fallback" width={96} className="shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="min-w-0 truncate text-[30px] font-semibold leading-[37px] text-foreground">
                {project.name}
              </h1>
              {project.repoUrl && (
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${project.name} repository`}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <GithubIcon size={22} />
                </a>
              )}
            </div>
            {project.description && (
              <p className="mt-[8px] max-w-[640px] text-[16px] leading-[22px] text-muted-foreground">
                {project.description}
              </p>
            )}
            <Link
              href={`/people/${project.handle}`}
              className="mt-[12px] flex w-fit items-center gap-2 text-[14px] text-muted-foreground hover:text-foreground"
            >
              <Avatar handle={project.handle} size={24} className="shrink-0 rounded-full" />
              <span>@{project.handle}</span>
            </Link>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <SectionLabel>{project.liveSessions > 0 ? 'LIVE NOW' : 'SESSIONS'}</SectionLabel>
          <p className="mt-[6px] font-mono text-[28px] leading-[34px] text-foreground">
            {project.liveSessions > 0 ? project.liveSessions : project.sessionCount}
          </p>
        </div>
      </Panel>

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {hasActivity && <TabsTrigger value="activity">Activity</TabsTrigger>}
          {hasRepo && <TabsTrigger value="repository">Repository</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview">
          <Panel className="mt-4">
            <div className="flex flex-wrap gap-[60px]">
              <Stat label="SESSIONS" value={project.sessionCount.toLocaleString('en-GB')} />
              <Stat label="LIVE NOW" value={String(project.liveSessions)} />
              <Stat label="PUBLISHED" value={formatDate(project.createdAtMs)} />
            </div>
            {repo.kind === 'ready' && repo.repo.topics.length > 0 && (
              <div className="mt-[22px] flex flex-wrap gap-2">
                {repo.repo.topics.map((t) => (
                  <span
                    key={t}
                    className="flex h-[30px] items-center rounded-[15px] border border-border px-4 text-[13px] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        {hasActivity && (
          <TabsContent value="activity">
            <Panel className="mt-4">
              <ActivityChart weeks={activity.weeks} />
            </Panel>
          </TabsContent>
        )}

        {hasRepo && (
          <TabsContent value="repository">
            <Panel className="mt-4">
              {repo.kind === 'loading' ? (
                <LoadingRow label="Asking GitHub…" />
              ) : repo.kind === 'ready' ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-[40px]">
                    <Stat label="STARS" value={repo.repo.stars.toLocaleString('en-GB')} />
                    <Stat label="FORKS" value={repo.repo.forks.toLocaleString('en-GB')} />
                    <Stat label="OPEN ISSUES" value={repo.repo.openIssues.toLocaleString('en-GB')} />
                    {repo.repo.pushedAtMs && nowMs && (
                      <Stat label="LAST PUSH" value={ago(nowMs - repo.repo.pushedAtMs)} />
                    )}
                  </div>
                  {repo.repo.description && (
                    <p className="mt-[18px] max-w-[820px] text-[15px] leading-[20px] text-muted-foreground">
                      {repo.repo.description}
                    </p>
                  )}
                  {repo.repo.languages.length > 0 && (
                    <div className="mt-[26px]">
                      <LanguagePie languages={repo.repo.languages} />
                    </div>
                  )}
                </>
              ) : (
                // Not the visitor's fault and nothing is broken, so this is
                // muted text rather than a destructive-coloured error.
                <p className="text-[15px] text-muted-foreground">
                  {repo.kind === 'limited'
                    ? 'GitHub is rate-limiting us right now. The repo link above still works.'
                    : 'Could not reach GitHub.'}
                </p>
              )}
            </Panel>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-[6px] font-mono text-[18px] leading-[23px] text-foreground">{value}</p>
    </div>
  );
}
