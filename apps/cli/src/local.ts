// What is on this machine — skills and project folders. These functions read
// local disk and return; they never call the network. Only the `publish`
// commands in index.ts transmit, and only what you named on the command line.
//
// This is Path B (kerf-spec.md §6): a skill's text is something you wrote and
// chose to share. Path A's transcript telemetry is untouched by anything here.

import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { listCodexSessionFiles } from './extract-codex.ts';

export type LocalSkill = { slug: string; name: string; description: string; path: string; content: string };
export type LocalProject = { cwd: string; projectHash: string; sessions: number };

const SKILLS_DIR = join(homedir(), '.claude', 'skills');
const PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/**
 * Pulls `name:` and `description:` out of a SKILL.md's YAML frontmatter.
 * Deliberately not a YAML parser — frontmatter here is a handful of scalar
 * keys, and a dependency to read two of them would be silly.
 */
function frontmatter(text: string): Record<string, string> {
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  if (end === -1) return {};

  const lines = text.slice(3, end).split('\n');
  const out: Record<string, string> = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sep = line.indexOf(':');
    if (sep === -1 || line.startsWith(' ')) continue;
    const key = line.slice(0, sep).trim();
    const value = line
      .slice(sep + 1)
      .trim()
      .replace(/^["']|["']$/g, '');

    // A YAML folded/literal block (`description: >` or `|`) puts the value on
    // the following indented lines. Without this the value is literally ">",
    // which is what a published skill's description used to be.
    if (value === '>' || value === '|' || value === '>-' || value === '|-') {
      const block: string[] = [];
      while (i + 1 < lines.length && (lines[i + 1].startsWith('  ') || lines[i + 1].trim() === '')) {
        i += 1;
        block.push(lines[i].trim());
      }
      out[key] = block.join(value.startsWith('>') ? ' ' : '\n').trim();
      continue;
    }
    out[key] = value;
  }
  return out;
}

export async function listLocalSkills(): Promise<LocalSkill[]> {
  if (!existsSync(SKILLS_DIR)) return [];
  const dirs = await readdir(SKILLS_DIR, { withFileTypes: true });
  const skills: LocalSkill[] = [];
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const path = join(SKILLS_DIR, dir.name, 'SKILL.md');
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf8');
    const meta = frontmatter(content);
    skills.push({
      slug: dir.name,
      name: meta.name ?? dir.name,
      description: meta.description ?? '',
      path,
      content,
    });
  }
  return skills.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** The cwd recorded in a transcript's first record, or null if it has none. */
async function firstCwd(file: string): Promise<string | null> {
  const rl = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line) continue;
      try {
        const record = JSON.parse(line) as { cwd?: string };
        if (record.cwd) return record.cwd;
      } catch {
        continue;
      }
    }
  } finally {
    rl.close();
  }
  return null;
}

/** The cwd recorded in a Codex session_meta record, or null if it has none. */
async function firstCodexCwd(file: string): Promise<string | null> {
  const rl = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line) continue;
      try {
        const record = JSON.parse(line) as { type?: string; payload?: { cwd?: string } };
        if (record.type === 'session_meta' && record.payload?.cwd) return record.payload.cwd;
      } catch {
        continue;
      }
    }
  } finally {
    rl.close();
  }
  return null;
}

/**
 * Project folders you have worked in, recovered from the transcripts' own `cwd`
 * — NOT from the directory name, whose path encoding is lossy (spec §5.1).
 * Merges Claude Code and Codex sessions into one map rather than exposing two
 * separate lists: a repo you only ever used Codex in must not be invisible to
 * `kerf projects`/`kerf projects publish`, and this is also where the §7.4
 * season commit floor (apps/cli/src/git.ts) gets its full repo list from.
 */
export async function listLocalProjects(): Promise<LocalProject[]> {
  const byCwd = new Map<string, number>();

  if (existsSync(PROJECTS_DIR)) {
    const dirs = await readdir(PROJECTS_DIR, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const entries = await readdir(join(PROJECTS_DIR, dir.name), { withFileTypes: true });
      const files = entries.filter((e) => e.isFile() && e.name.endsWith('.jsonl'));
      if (files.length === 0) continue;
      const cwd = await firstCwd(join(PROJECTS_DIR, dir.name, files[0].name));
      if (!cwd) continue;
      byCwd.set(cwd, (byCwd.get(cwd) ?? 0) + files.length);
    }
  }

  for (const file of await listCodexSessionFiles()) {
    const cwd = await firstCodexCwd(file);
    if (!cwd) continue;
    byCwd.set(cwd, (byCwd.get(cwd) ?? 0) + 1);
  }

  return [...byCwd.entries()]
    .map(([cwd, sessions]) => ({ cwd, projectHash: createHash('sha256').update(cwd).digest('hex'), sessions }))
    .sort((a, b) => b.sessions - a.sessions);
}
