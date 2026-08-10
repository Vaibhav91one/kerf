// Typed client for the real @kerf/backend routes. No invented endpoints —
// every function here maps 1:1 to a route in apps/backend/src/index.ts.
import type { SessionMetric } from '@kerf/shared';

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

export type Standing = {
  /** §7.2 season score: the winsorised median of the player's qualifying sessions. */
  score: number | null;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | null;
  progress: { next: string; pct: number } | null;
  sessionCount: number;
};

export type Badge = { id: string; label: string; earned: boolean };
export type Tip = { id: string; title: string; message: string; trigger: string };
export type TierCuts = { p20: number; p50: number; p80: number; p95: number };

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
};

/** Row shape of the public directory — GET /api/profiles in apps/backend/src/index.ts. */
export type ProfileSummary = {
  handle: string;
  displayName: string;
  bio: string | null;
  publicSkills: boolean;
  avatarUrl: string | null;
  createdAtMs: number;
};

export type ClerkProfileResponse ={ profile: Pick<PublicProfile, 'handle' | 'displayName' | 'bio' | 'publicSkills' | 'avatarUrl' | 'websiteUrl' | 'githubUrl' | 'xUrl' | 'createdAtMs'> | null };

export type ProjectJson = {
  id: string;
  handle: string;
  name: string;
  description: string | null;
  repoUrl: string | null;
  createdAtMs: number;
  /** Sessions carrying this project's hash. Present on the list route only. */
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
  name: string;
  count: number;
  users: number;
  /** Highest-count handles for this tool, opted-in accounts only. */
  topUsers: { handle: string; count: number }[];
};

export type MySession = SessionMetric & { tips: Tip[] };

export type MeSessions = {
  sessions: MySession[];
  toolTotals: Record<string, number>;
  streak: number;
  badges: Badge[];
};

export type SeasonStanding = {
  handle: string;
  /** §7.2 season score: the winsorised median of this player's qualifying sessions. */
  score: number;
  tier: Standing['tier'];
  sessionCount: number;
  /** Display-only, like sessionCount — the board is ordered on the ratio alone (§7.2). */
  streak: number;
};

export type SeasonCurrent = {
  metric: 'rework_ratio';
  higherIsBetter: false;
  sampleSize: number;
  cuts: TierCuts;
  /** Ten fixed buckets across [0,1] — counts of qualifying sessions per band. */
  histogram: number[];
  standings: SeasonStanding[];
  ghosts: unknown[];
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
  createdAtMs: number;
  isStarredByMe?: boolean;
};

export type SkillDetail = SkillJson & { isStarredByMe: boolean };

export type OwnProfile = {
  handle: string;
  displayName: string;
  bio: string | null;
  publicSkills: boolean;
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

  claimCliLogin: (token: string, code: string) =>
    request<{ status: 'claimed'; handle: string }>(`/api/cli-login/${encodeURIComponent(code)}/claim`, { method: 'POST', token }),

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

  profiles: () => request<{ profiles: ProfileSummary[] }>('/api/profiles'),

  profile: (handle: string) => request<PublicProfile>(`/api/profiles/${encodeURIComponent(handle)}`),

  skills: () => request<{ skills: SkillTotal[] }>('/api/skills'),

  projects: () => request<{ projects: ProjectJson[] }>('/api/projects'),

  createProject: (token: string, body: { name: string; description?: string; repoUrl?: string }) =>
    request<ProjectJson>('/api/projects', { method: 'POST', token, body: JSON.stringify(body) }),

  liveSessions: () => request<{ sessions: LiveSessionJson[] }>('/api/live/sessions'),

  chatHistory: () => request<{ messages: ChatMessageJson[] }>('/api/chat'),

  postChat: (token: string, body: string) =>
    request<ChatMessageJson>('/api/chat', { method: 'POST', token, body: JSON.stringify({ body }) }),

  mySessions: (token: string) => request<MeSessions>('/api/me/sessions', { token }),

  seasonCurrent: () => request<SeasonCurrent>('/api/season/current'),

  skillLibrary: (sort?: 'stars' | 'recent', token?: string) =>
    request<{ skills: SkillJson[] }>(`/api/skill-library${sort ? `?sort=${sort}` : ''}`, { token }),

  skillBySlug: (slug: string, token?: string) =>
    request<SkillDetail>(`/api/skill-library/by-slug/${encodeURIComponent(slug)}`, { token }),

  createSkill: (token: string, body: { name: string; description?: string; content: string }) =>
    request<SkillJson>('/api/skill-library', { method: 'POST', token, body: JSON.stringify(body) }),

  toggleSkillStar: (token: string, id: string) =>
    request<{ starred: boolean; starCount: number }>(`/api/skill-library/${id}/star`, { method: 'POST', token }),
};

export function liveStreamUrl(): string {
  return `${API_URL}/api/live/stream`;
}
