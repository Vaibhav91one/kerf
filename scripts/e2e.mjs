const API = 'http://127.0.0.1:3211';
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

// 11. Season standings.
const season = await req('GET', '/api/season/current');
log('11. season:', { metric: season.json.metric, sampleSize: season.json.sampleSize, cuts: season.json.cuts });
log('    standings:', season.json.standings);

// 12. What the SSE stream actually saw.
await new Promise((r) => setTimeout(r, 300));
const types = frames.join('').split('\n').filter((l) => l.startsWith('event:'));
log('12. SSE frames observed:', types);
ac.abort();
await new Promise((r) => setTimeout(r, 200));
log('    streams after disconnect:', (await req('GET', '/health')).json);

console.log(out.join('\n'));
