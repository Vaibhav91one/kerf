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
  avgReworkRatio: number | null;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | null;
  progress: { next: string; pct: number } | null;
  sessionCount: number;
};

export type Badge = { id: string; label: string; earned: boolean };
export type Tip = { id: string; message: string };
export type TierCuts = { p20: number; p50: number; p80: number; p95: number };

export type PublicProfile = {
  handle: string;
  displayName: string;
  bio: string | null;
  createdAtMs: number;
  standing: Standing;
  streak: number;
  badges: Badge[];
  publicSkills: boolean;
  skills: Record<string, number> | null;
  projects: ProjectJson[];
};

export type ProjectJson = {
  id: string;
  handle: string;
  name: string;
  description: string | null;
  repoUrl: string | null;
  createdAtMs: number;
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

export type SkillTotal = { name: string; count: number; users: number };

export type MySession = SessionMetric & { tips: Tip[] };

export type MeSessions = {
  sessions: MySession[];
  toolTotals: Record<string, number>;
  streak: number;
  badges: Badge[];
};

export type SeasonStanding = { handle: string; avgReworkRatio: number; tier: Standing['tier']; sessionCount: number };

export type SeasonCurrent = {
  metric: 'rework_ratio';
  higherIsBetter: false;
  sampleSize: number;
  cuts: TierCuts;
  standings: SeasonStanding[];
  ghosts: unknown[];
};

export const api = {
  health: () => request<{ ok: boolean; streams: number }>('/health'),

  createProfile: (body: { handle: string; displayName: string; bio?: string; publicSkills?: boolean }) =>
    request<{ handle: string; token: string }>('/api/profiles', { method: 'POST', body: JSON.stringify(body) }),

  updateMyProfile: (token: string, body: { displayName: string; bio?: string; publicSkills?: boolean }) =>
    request<{ handle: string; displayName: string; bio: string | null; publicSkills: boolean }>('/api/me/profile', {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    }),

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
};

export function liveStreamUrl(): string {
  return `${API_URL}/api/live/stream`;
}
