// Overridable so the suite can run against a second backend without stopping
// whatever is already on the default port.
const API = process.env.KERF_API_URL ?? 'http://127.0.0.1:3211';
const ADMIN = 'devtoken-abc';
const out = [];
const log = (...a) => out.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));

async function req(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

const uuid = (n) => `0000000${n}-0000-4000-8000-00000000000${n}`;
const hash = (c) => c.repeat(64);
const metric = (n, over = {}) => ({
  source: 'claude-code',
  sessionId: uuid(n),
  projectHash: hash('a'),
  startedMs: Date.now() - 3_600_000,
  endedMs: Date.now() - 60_000,
  turns: 8,
  edits: 6,
  editsRework: 2,
  reworkRatio: 2 / 6,
  qualifies: true,
  toolCounts: { Edit: 6, Bash: 3, 'mcp__plugin_figma_figma__use_figma': 2 },
  ...over,
});

// 1. SSE stream attached first so it can observe everything that follows.
const frames = [];
const ac = new AbortController();
const streamRes = await fetch(`${API}/api/live/stream`, { signal: ac.signal });
(async () => {
  const reader = streamRes.body.getReader();
  const dec = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      frames.push(dec.decode(value));
    }
  } catch {}
})();
await new Promise((r) => setTimeout(r, 300));
log('1. SSE attached, health:', (await req('GET', '/health')).json);

// 2. Seeded env profile authenticates.
log('2. env-seeded token -> /api/me/sessions:', (await req('GET', '/api/me/sessions', { token: ADMIN })).status);
log('   bad token rejected:', (await req('GET', '/api/me/sessions', { token: 'nope' })).status);

// 3. Create a second account.
const created = await req('POST', '/api/profiles', {
  body: { handle: 'Ada', displayName: 'Ada L', bio: 'building kerf in public', publicSkills: true },
});
log('3. POST /api/profiles:', created.status, { handle: created.json.handle, tokenLen: String(created.json.token).length });
const ADA = created.json.token;
log('   duplicate handle:', (await req('POST', '/api/profiles', { body: { handle: 'ada', displayName: 'x' } })).status);

// 4. Privacy gate still closed on the telemetry path.
const bad = await req('POST', '/api/metrics', { token: ADA, body: [{ ...metric(1), promptText: 'secret' }] });
log('4. metrics w/ extra field:', bad.status, bad.json);

// 5. Real telemetry for both accounts.
log('5. ada metrics:', (await req('POST', '/api/metrics', { token: ADA, body: [metric(1), metric(2, { editsRework: 0, reworkRatio: 0 })] })).json);
log('   vaibhav metrics:', (await req('POST', '/api/metrics', { token: ADMIN, body: [metric(3, { editsRework: 5, reworkRatio: 5 / 6 })] })).json);

// 6. Cross-account overwrite attempt: same sessionId, different owner.
await req('POST', '/api/metrics', { token: ADMIN, body: [metric(1, { turns: 999 })] });
const adaSessions = await req('GET', '/api/me/sessions', { token: ADA });
const s1 = adaSessions.json.sessions.find((s) => s.sessionId === uuid(1));
log('6. ada session 1 turns after other account posted same id:', s1.turns, '(expect 8, not 999)');
log('   ada badges earned:', adaSessions.json.badges.filter((b) => b.earned).map((b) => b.id));
log('   ada streak:', adaSessions.json.streak);

// 7. Build in public.
const proj = await req('POST', '/api/projects', {
  token: ADA,
  body: { name: 'kerf', description: 'competitive league for CLI agents', repoUrl: 'https://github.com/Vaibhav91one/kerf', projectHash: hash('a') },
});
log('7. POST /api/projects:', proj.status, proj.json);
log('   javascript: url rejected:', (await req('POST', '/api/projects', { token: ADA, body: { name: 'x', repoUrl: 'javascript:alert(1)' } })).status);

// 8. Heartbeat -> live session, resolved to the published project.
const hb = await req('POST', '/api/heartbeat', {
  token: ADA,
  body: { source: 'claude-code', sessionId: uuid(4), projectHash: hash('a'), startedMs: Date.now() - 120_000, atMs: Date.now(), turns: 3, edits: 4, editsRework: 1 },
});
log('8. POST /api/heartbeat:', hb.status, hb.json);
const live = await req('GET', '/api/live/sessions');
log('   GET /api/live/sessions:', live.json.sessions.map((s) => ({ handle: s.handle, projectId: s.projectId === proj.json.id ? '<matches project>' : s.projectId, turns: s.turns, reworkRatio: s.reworkRatio })));
log('   heartbeat w/ free text:', (await req('POST', '/api/heartbeat', { token: ADA, body: { source: 'claude-code', sessionId: uuid(4), projectHash: hash('a'), startedMs: 1, atMs: 2, turns: 1, edits: 1, editsRework: 0, filePath: '/secret' } })).json);

// 8b. A PRIVATE project is absent, not blanked — for anonymous readers and for
// other members. "Absent" is the point: a 404 that matches a row that never
// existed is what stops the id being an existence oracle.
const secret = await req('POST', '/api/projects', {
  token: ADA,
  body: { name: 'stealth', projectHash: hash('b'), isPublic: false },
});
log('8b. POST private project:', secret.status, 'isPublic:', secret.json.isPublic, '(expect false)');
const anonList = await req('GET', '/api/projects');
log('    anon list contains it:', anonList.json.projects.some((p) => p.id === secret.json.id), '(expect false)');
const ownerList = await req('GET', '/api/projects', { token: ADA });
log('    owner list contains it:', ownerList.json.projects.some((p) => p.id === secret.json.id), '(expect true)');
log('    anon GET /:id:', (await req('GET', `/api/projects/${secret.json.id}`)).status, '(expect 404)');
log('    other member GET /:id:', (await req('GET', `/api/projects/${secret.json.id}`, { token: ADMIN })).status, '(expect 404)');
log('    owner GET /:id:', (await req('GET', `/api/projects/${secret.json.id}`, { token: ADA })).status, '(expect 200)');
log('    anon /activity:', (await req('GET', `/api/projects/${secret.json.id}/activity`)).status, '(expect 404)');
log('    anon profile lists it:', (await req('GET', '/api/profiles/ada')).json.projects.some((p) => p.id === secret.json.id), '(expect false)');

// 8c. Visibility PATCH is owner-scoped, same invariant as delete.
log('8c. other member PATCH:', (await req('PATCH', `/api/projects/${secret.json.id}`, { token: ADMIN, body: { isPublic: true } })).status, '(expect 404)');
log('    owner PATCH -> public:', (await req('PATCH', `/api/projects/${secret.json.id}`, { token: ADA, body: { isPublic: true } })).status, '(expect 200)');
log('    now in anon list:', (await req('GET', '/api/projects')).json.projects.some((p) => p.id === secret.json.id), '(expect true)');
await req('PATCH', `/api/projects/${secret.json.id}`, { token: ADA, body: { isPublic: false } });

// 8d. A session in a private project leaves the live feed entirely — for
// everyone, the owner included. The owner's own status comes from
// /api/me/sessions instead, which is why that route carries liveSessions.
await req('POST', '/api/heartbeat', {
  token: ADA,
  body: { source: 'claude-code', sessionId: uuid(5), projectHash: hash('b'), startedMs: Date.now() - 60_000, atMs: Date.now(), turns: 2, edits: 2, editsRework: 0 },
});
const liveAfter = await req('GET', '/api/live/sessions');
log('8d. private session in live feed:', liveAfter.json.sessions.some((s) => s.sessionId === uuid(5)), '(expect false)');
log('    public session still there:', liveAfter.json.sessions.some((s) => s.sessionId === uuid(4)), '(expect true)');
log('    owner sees own live count:', (await req('GET', '/api/me/sessions', { token: ADA })).json.liveSessions, '(expect >0)');

// 9. Chat + rate limit.
log('9. chat post:', (await req('POST', '/api/chat', { token: ADA, body: { body: 'first commit pushed' } })).status);
const burst = [];
for (let i = 0; i < 6; i++) burst.push((await req('POST', '/api/chat', { token: ADA, body: { body: `spam ${i}` } })).status);
log('   burst statuses:', burst, '(expect a 429 once the window fills)');
log('   chat history length:', (await req('GET', '/api/chat')).json.messages.length);

// 10. Public profile + skills browse.
const pub = await req('GET', '/api/profiles/ada');
log('10. GET /api/profiles/ada standing:', pub.json.standing, 'skills:', pub.json.skills, 'projects:', pub.json.projects.length);
const priv = await req('GET', '/api/profiles/vaibhav');
log('    vaibhav (publicSkills off) skills:', priv.json.skills);
log('    GET /api/skills:', (await req('GET', '/api/skills')).json.skills);

// 10b. Hiding one skill is keyed, not global: the hidden row leaves /api/skills
// and the public profile for EVERYONE (so the totals stay viewer-independent),
// while its siblings are untouched and the owner still sees it in toolTotals.
const hideKey = 'mcp:plugin_figma_figma';
log('10b. PATCH skill-visibility:', (await req('PATCH', '/api/me/skill-visibility', { token: ADA, body: { hiddenSkills: [hideKey] } })).status, '(expect 200)');
const afterHide = (await req('GET', '/api/skills')).json.skills;
log('     hidden key still listed:', afterHide.some((s) => s.name === hideKey), '(expect false)');
log('     sibling Edit still listed:', afterHide.some((s) => s.name === 'builtin:Edit'), '(expect true)');
log('     public profile skills:', (await req('GET', '/api/profiles/ada')).json.skills);
log('     owner toolTotals still has raw key:', 'mcp__plugin_figma_figma__use_figma' in (await req('GET', '/api/me/sessions', { token: ADA })).json.toolTotals, '(expect true)');
log('     malformed key rejected:', (await req('PATCH', '/api/me/skill-visibility', { token: ADA, body: { hiddenSkills: ['nope'] } })).status, '(expect 400)');
log('     builtin: key rejected:', (await req('PATCH', '/api/me/skill-visibility', { token: ADA, body: { hiddenSkills: ['builtin:Edit'] } })).status, '(expect 400)');
await req('PATCH', '/api/me/skill-visibility', { token: ADA, body: { hiddenSkills: [] } });

// 10c. The shared library, which this suite never covered before. A private
// skill must not ship its `content` to an anonymous list, and the two write
// oracles (star, install) must answer 404 rather than confirming it exists.
const pubSkill = await req('POST', '/api/skill-library', { token: ADA, body: { name: 'Open Skill', content: '# open' } });
const privSkill = await req('POST', '/api/skill-library', { token: ADA, body: { name: 'Secret Skill', content: '# secret', isPublic: false } });
log('10c. published public/private:', pubSkill.status, privSkill.status, 'private isPublic:', privSkill.json.isPublic, '(expect false)');
const anonLib = (await req('GET', '/api/skill-library')).json.skills;
log('     anon library has private:', anonLib.some((s) => s.id === privSkill.json.id), '(expect false)');
log('     anon library has public:', anonLib.some((s) => s.id === pubSkill.json.id), '(expect true)');
log('     owner library has private:', (await req('GET', '/api/skill-library', { token: ADA })).json.skills.some((s) => s.id === privSkill.json.id), '(expect true)');
log('     anon by-slug:', (await req('GET', `/api/skill-library/by-slug/${privSkill.json.slug}`)).status, '(expect 404)');
log('     owner by-slug:', (await req('GET', `/api/skill-library/by-slug/${privSkill.json.slug}`, { token: ADA })).status, '(expect 200)');
log('     other member star:', (await req('POST', `/api/skill-library/${privSkill.json.id}/star`, { token: ADMIN })).status, '(expect 404)');
log('     other member install:', (await req('POST', `/api/skill-library/by-slug/${privSkill.json.slug}/install`, { token: ADMIN })).status, '(expect 404)');
log('     owner install:', (await req('POST', `/api/skill-library/by-slug/${privSkill.json.slug}/install`, { token: ADA })).status, '(expect 200)');
log('     other member PATCH:', (await req('PATCH', `/api/skill-library/${privSkill.json.id}`, { token: ADMIN, body: { isPublic: true } })).status, '(expect 404)');
log('     owner PATCH:', (await req('PATCH', `/api/skill-library/${privSkill.json.id}`, { token: ADA, body: { isPublic: true } })).status, '(expect 200)');

// 11. Season standings.
const season = await req('GET', '/api/season/current');
log('11. season:', { metric: season.json.metric, sampleSize: season.json.sampleSize, levels: season.json.levels?.length });
log('    standings:', season.json.standings);

// 11b. Unpublish is owner-scoped: another account's delete must not land.
const foreignDelete = await req('DELETE', `/api/projects/${proj.json.id}`, { token: ADMIN });
log('11b. other account deleting ada\'s project:', foreignDelete.status, '(expect 404)');
log('     project still listed:', (await req('GET', '/api/projects')).json.projects.some((p) => p.id === proj.json.id));
log('     owner delete:', (await req('DELETE', `/api/projects/${proj.json.id}`, { token: ADA })).status);
log('     project gone:', !(await req('GET', '/api/projects')).json.projects.some((p) => p.id === proj.json.id));

// 12. What the SSE stream actually saw.
await new Promise((r) => setTimeout(r, 300));
const types = frames.join('').split('\n').filter((l) => l.startsWith('event:'));
log('12. SSE frames observed:', types);
// A row created private must never have been broadcast. The fan-out happens at
// create time, which is why visibility is chosen before the row exists rather
// than flipped afterwards.
const wire = frames.join('');
log('    private project id ever on the wire:', wire.includes(secret.json.id), '(expect false)');
log('    private skill id ever on the wire:', wire.includes(privSkill.json.id), '(expect false)');
log('    public skill id on the wire:', wire.includes(pubSkill.json.id), '(expect true)');
ac.abort();
await new Promise((r) => setTimeout(r, 200));
log('    streams after disconnect:', (await req('GET', '/health')).json);

// 13. Abuse limits. These run last because they deliberately spend a budget.
const bulk = (n, offset) =>
  Array.from({ length: n }, (_, i) => {
    const id = String(offset + i).padStart(12, '0');
    return { ...metric(1), sessionId: `00000000-0000-4000-8000-${id}` };
  });

const oversize = await req('POST', '/api/metrics', { token: ADMIN, body: bulk(1001, 1_000) });
log('13. 1001 metrics in one request:', oversize.status, '(expect 413)');

// The serial upsert rewrite must not lose or truncate anything.
const fifty = await req('POST', '/api/metrics', { token: ADMIN, body: bulk(50, 2_000) });
log('    50 valid metrics after the serial rewrite:', fifty.json, '(expect accepted 50)');

const projectBurst = [];
for (let i = 0; i < 11; i++) {
  projectBurst.push((await req('POST', '/api/projects', { token: ADMIN, body: { name: `burst-${i}` } })).status);
}
log('    11 projects in a row:', projectBurst, '(expect the tail to 429)');

console.log(out.join('\n'));
