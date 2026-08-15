// Typed client for the real @kerf/backend routes. No invented endpoints —
// every function here maps 1:1 to a route in apps/backend/src/index.ts.
import type { SessionMetric } from '@kerf/shared';

// A silent localhost fallback in production means every browser fetches a
// backend that doesn't exist there — the build succeeds and the outage has no
// error anywhere. Throwing at build/boot time turns that into a failed deploy.
if (!process.env.NEXT_PUBLIC_API_URL && process.env.NODE_ENV === 'production') {
  throw new Error('NEXT_PUBLIC_API_URL is not set — see zerops.yml build.envVariables');
}
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3211';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const { token, ...rest } = init ?? {};
  const res = await fetch(`${API_URL}${path}`, {
    ...(token ? { cache: 'no-store' as const } : {}),
    ...rest,
    headers: {
      ...(rest.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

/** Lifetime points and the level they buy — see packages/shared/src/points.ts. */
export type Rank = { tier: Tier; next: Tier | null; nextAt: number | null; pct: number };

export type Standing = Rank & {
  points: number;
  sessionCount: number;
};

export type Badge = {
  id: string;
  label: string;
  earned: boolean;
  /** have is clamped to need, so have/need is a bar fraction. */
  progress: { have: number; need: number };
  /** One imperative line: what to do to earn it. */
  requirement: string;
};
export type Tip = { id: string; title: string; message: string; trigger: string };

export type PublicProfile = {
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  xUrl: string | null;
  createdAtMs: number;
  standing: Standing;
  streak: number;
  badges: Badge[];
  publicSkills: boolean;
  skills: Record<string, number> | null;
  projects: ProjectJson[];
  followerCount: number;
  followingCount: number;
  isFollowedByMe: boolean;
  isRivalOfMe: boolean;
};

/** One row of GET /api/me/follows — who you follow, and which are rivals. */
export type FollowEdge = { handle: string; isRival: boolean };

/** Row shape of the public directory — GET /api/profiles in apps/backend/src/index.ts. */
export type PublicProfileSummary = Pick<
  PublicProfile,
  'handle' | 'displayName' | 'bio' | 'publicSkills' | 'avatarUrl' | 'createdAtMs'
>;

export type ClerkProfileResponse ={ profile: Pick<PublicProfile, 'handle' | 'displayName' | 'bio' | 'publicSkills' | 'avatarUrl' | 'websiteUrl' | 'githubUrl' | 'xUrl' | 'createdAtMs'> | null };

export type ProjectJson = {
  id: string;
  handle: string;
  name: string;
  description: string | null;
  repoUrl: string | null;
  /** http(s)-only, same allow-list as repoUrl. Null falls back to illustration. */
  logoUrl: string | null;
  /**
   * False = published but not public. A private row is ABSENT from every public
   * read, so a stranger only ever receives `true` here — it exists so the
   * owner's own screens can draw the toggle.
   */
  isPublic: boolean;
  createdAtMs: number;
  /** Sessions carrying this project's hash. Served by both the list and detail routes. */
  sessionCount?: number;
};

export type LiveSessionJson = {
  handle: string;
  sessionId: string;
  projectId: string | null;
  startedMs: number;
  lastBeatMs: number;
  turns: number;
  edits: number;
  editsRework: number;
  reworkRatio: number | null;
};

export type ChatMessageJson = { id: string; handle: string; body: string; createdAtMs: number };

export type SkillTotal = {
  /** Aggregation key, `${kind}:${label}` — unique, not for display. */
  name: string;
  /** `skill` = a Claude Code skill, `mcp` = one MCP server, `builtin` = a tool. */
  kind: 'skill' | 'mcp' | 'builtin';
  /** What to show: the skill slug, or the MCP server name. */
  label: string;
  count: number;
  users: number;
  /** Highest-count handles for this tool, opted-in accounts only. */
  topUsers: { handle: string; count: number }[];
};

/** GitHub's public repo facts, whitelisted and sanitised by the backend proxy. */
export type RepoJson = {
  /** Byte counts per language, biggest first — the pie's data. */
  languages: { name: string; bytes: number }[];
  fullName: string | null;
  description: string | null;
  homepage: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  topics: string[];
  pushedAtMs: number | null;
  archived: boolean;
};

export type ProjectDetail = ProjectJson & { liveSessions: number; sessionCount: number };

/** Aggregate counts only (§6) — no session ids, no per-session timestamps. */
export type ProjectActivity = { weeks: { weekStartMs: number; sessions: number }[] };

export type SkillsResponse = {
  window: '7d' | 'all';
  skills: SkillTotal[];
  /** Rotates at 00:00 UTC over the most-used skills. Null when there are none. */
  skillOfTheDay: SkillTotal | null;
};

export type MySession = SessionMetric & { points: number; tips: Tip[] };

/** A CLI credential — never the token itself, only a digest is ever stored. */
export type ApiTokenJson = { id: string; label: string; createdAtMs: number };

export type MeSessions = {
  sessions: MySession[];
  toolTotals: Record<string, number>;
  totalPoints: number;
  monthPoints: number;
  rank: Rank;
  /** False until `kerf login` has minted a token — /me hides the connect steps once true. */
  hasCliToken: boolean;
  /**
   * Your OWN live sessions, private projects included. The sidebar's Live dot
   * reads these rather than the public feed, which now hides a session in a
   * private project from everyone — the owner included.
   */
  liveSessions: number;
  lastBeatMs: number | null;
  /** When `kerf sync` last wrote a row, not when the newest session ran. */
  lastSyncedMs: number | null;
  streak: number;
  badges: Badge[];
  /** §7.4's season floor for the current UTC month. */
  seasonQualification: { qualified: boolean; sessions: number; commits: number };
};

export type SeasonStanding = {
  handle: string;
  /** Lifetime points — what the crest is cut from. */
  points: number;
  /** Points earned this UTC month — what the board is ordered on. */
  monthPoints: number;
  tier: Tier;
  sessionCount: number;
  streak: number;
  /** §7.4's season floor: 10 qualifying sessions AND 5 commits this month. */
  qualified: boolean;
  seasonSessions: number;
  seasonCommits: number;
};

export type SeasonCurrent = {
  metric: 'points';
  sampleSize: number;
  /** Fixed point thresholds per level, in ascending order. */
  levels: { tier: Tier; min: number }[];
  /** The §7.4 numbers standings.qualified is computed from — never hand-type these. */
  floor: { sessions: number; commits: number };
  standings: SeasonStanding[];
};

export type SkillJson = {
  id: string;
  handle: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  installCount: number;
  starCount: number;
  /** Same contract as ProjectJson.isPublic. */
  isPublic: boolean;
  createdAtMs: number;
  isStarredByMe?: boolean;
};

export type SkillDetail = SkillJson & { isStarredByMe: boolean };

export type OwnProfile = {
  handle: string;
  displayName: string;
  bio: string | null;
  publicSkills: boolean;
  /** `${kind}:${label}` keys hidden from every public surface. Own account only. */
  hiddenSkills: string[];
  avatarUrl: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  xUrl: string | null;
  createdAtMs: number;
};

export const api = {
  health: () => request<{ ok: boolean; streams: number }>('/health'),

  clerkMe: (token: string) => request<{ profile: OwnProfile | null }>('/api/clerk/me', { token }),

  upsertClerkProfile: (
    token: string,
    body: {
      handle?: string;
      displayName: string;
      bio?: string;
      publicSkills?: boolean;
      avatarUrl?: string;
      websiteUrl?: string;
      githubUrl?: string;
      xUrl?: string;
    },
  ) =>
    request<{ profile: OwnProfile }>('/api/clerk/profile', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),

  saveClerkProfile: (
    token: string,
    body: {
      handle?: string;
      displayName: string;
      bio?: string;
      publicSkills?: boolean;
      avatarUrl?: string;
      websiteUrl?: string;
      githubUrl?: string;
      xUrl?: string;
    },
  ) =>
    request<{ profile: OwnProfile }>('/api/clerk/profile', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),

  /**
   * `userCode` is what the person typed off their own terminal — the device
   * code the CLI is actually polling with is never sent to, or known by, the
   * browser. Typing it is the consent step a phishing link can't forge.
   */
  claimCliLogin: (token: string, userCode: string) =>
    request<{ status: 'claimed'; handle: string }>(`/api/cli-login/user/${encodeURIComponent(userCode)}/claim`, {
      method: 'POST',
      token,
    }),

  /**
   * Is this userCode still live? Lets the connect page say "expired" as soon
   * as it's typed rather than after the whole claim round-trip.
   *
   * Deliberately NOT `GET /api/cli-login/:deviceCode` — that route is the
   * CLI's collection point and requires the device code, which the browser
   * never has.
   */
  cliLoginStatus: (userCode: string) =>
    request<{ status: 'pending' | 'claimed' | 'expired' }>(
      `/api/cli-login/user/${encodeURIComponent(userCode)}/status`,
    ),

  createProfile: (body: { handle: string; displayName: string; bio?: string; publicSkills?: boolean }) =>
    request<{ handle: string; token: string }>('/api/profiles', { method: 'POST', body: JSON.stringify(body) }),

  updateMyProfile: (
    token: string,
    body: {
      displayName: string;
      bio?: string;
      publicSkills?: boolean;
      avatarUrl?: string;
      websiteUrl?: string;
      githubUrl?: string;
      xUrl?: string;
    },
  ) =>
    request<{
      handle: string;
      displayName: string;
      bio: string | null;
      publicSkills: boolean;
      avatarUrl: string | null;
      websiteUrl: string | null;
      githubUrl: string | null;
      xUrl: string | null;
    }>('/api/me/profile', {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    }),

  profiles: () => request<{ profiles: PublicProfileSummary[] }>('/api/profiles'),

  // token is optional and only affects two output fields — isFollowedByMe and
  // isRivalOfMe — computed from the viewer the backend derives via
  // optionalHandle(req). Without it (server-side metadata fetch, or a signed-
  // out visitor) those two fields come back false, which is correct: an
  // anonymous viewer follows nobody.
  profile: (handle: string, token?: string) =>
    request<PublicProfile>(`/api/profiles/${encodeURIComponent(handle)}`, { token }),


  skills: (window?: '7d') => request<SkillsResponse>(`/api/skills${window ? `?window=${window}` : ''}`),

  /** With a token the caller also gets their own private rows — /me needs that. */
  projects: (token?: string) => request<{ projects: ProjectJson[] }>('/api/projects', { token }),

  project: (id: string, token?: string) => request<ProjectDetail>(`/api/projects/${encodeURIComponent(id)}`, { token }),

  /** 404 simply means "this project has no github repo" — not an error. */
  projectGithub: (id: string, token?: string) =>
    request<RepoJson>(`/api/projects/${encodeURIComponent(id)}/github`, { token }),

  projectActivity: (id: string, token?: string) =>
    request<ProjectActivity>(`/api/projects/${encodeURIComponent(id)}/activity`, { token }),

  createProject: (
    token: string,
    body: { name: string; description?: string; repoUrl?: string; logoUrl?: string; isPublic?: boolean },
  ) => request<ProjectJson>('/api/projects', { method: 'POST', token, body: JSON.stringify(body) }),

  setProjectVisibility: (token: string, id: string, isPublic: boolean) =>
    request<{ ok: true; isPublic: boolean }>(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ isPublic }),
    }),

  deleteProject: (token: string, id: string) =>
    request<{ ok: true }>(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE', token }),

  deleteSkill: (token: string, id: string) =>
    request<{ ok: true }>(`/api/skill-library/${encodeURIComponent(id)}`, { method: 'DELETE', token }),

  liveSessions: () => request<{ sessions: LiveSessionJson[] }>('/api/live/sessions'),

  chatHistory: () => request<{ messages: ChatMessageJson[] }>('/api/chat'),

  postChat: (token: string, body: string) =>
    request<ChatMessageJson>('/api/chat', { method: 'POST', token, body: JSON.stringify({ body }) }),

  mySessions: (token: string) => request<MeSessions>('/api/me/sessions', { token }),

  myTokens: (token: string) => request<{ tokens: ApiTokenJson[] }>('/api/me/tokens', { token }),

  revokeToken: (token: string, id: string) =>
    request<{ ok: true }>(`/api/me/tokens/${encodeURIComponent(id)}`, { method: 'DELETE', token }),

  myFollows: (token: string) => request<{ following: FollowEdge[] }>('/api/me/follows', { token }),

  toggleFollow: (token: string, handle: string) =>
    request<{ following: boolean; followerCount: number }>(`/api/follows/${encodeURIComponent(handle)}`, {
      method: 'POST',
      token,
    }),

  setRival: (token: string, handle: string, isRival: boolean) =>
    request<{ isRival: boolean }>(`/api/follows/${encodeURIComponent(handle)}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ isRival }),
    }),

  seasonCurrent: () => request<SeasonCurrent>('/api/season/current'),

  skillLibrary: (sort?: 'stars' | 'recent', token?: string) =>
    request<{ skills: SkillJson[] }>(`/api/skill-library${sort ? `?sort=${sort}` : ''}`, { token }),

  skillBySlug: (slug: string, token?: string) =>
    request<SkillDetail>(`/api/skill-library/by-slug/${encodeURIComponent(slug)}`, { token }),

  createSkill: (token: string, body: { name: string; description?: string; content: string; isPublic?: boolean }) =>
    request<SkillJson>('/api/skill-library', { method: 'POST', token, body: JSON.stringify(body) }),

  setSkillVisibility: (token: string, id: string, isPublic: boolean) =>
    request<{ ok: true; isPublic: boolean }>(`/api/skill-library/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ isPublic }),
    }),

  /** Last-write-wins over the whole list — one person editing their own preference. */
  setHiddenSkills: (token: string, hiddenSkills: string[]) =>
    request<{ hiddenSkills: string[] }>('/api/me/skill-visibility', {
      method: 'PATCH',
      token,
      body: JSON.stringify({ hiddenSkills }),
    }),

  toggleSkillStar: (token: string, id: string) =>
    request<{ starred: boolean; starCount: number }>(`/api/skill-library/${id}/star`, { method: 'POST', token }),
};

export function liveStreamUrl(): string {
  return `${API_URL}/api/live/stream`;
}
