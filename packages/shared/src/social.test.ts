import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS, cleanHandle, cleanMultilineText, cleanRepoUrl, cleanText, githubRepo, formatSkillLabel,
  classifyTool, searchNeedle,
} from './social.ts';

test('cleanText trims and collapses whitespace', () => {
  assert.equal(cleanText('  hello   world  ', 100), 'hello world');
});

test('cleanText flattens newlines — one message cannot scroll the room away', () => {
  assert.equal(cleanText('a\n\n\n\n\n\n\nb', 100), 'a b');
});

test('cleanText strips bidi overrides — no faking another handle in chat', () => {
  assert.equal(cleanText('nice work \u202Ereverse-me', 100), 'nice work reverse-me');
});

test('cleanText strips C0/C1 control characters', () => {
  assert.equal(cleanText('ok\u0000 fi\u0007ne', 100), 'ok fi ne');
});

test('cleanText rejects over-length input rather than truncating it', () => {
  assert.equal(cleanText('x'.repeat(LIMITS.chatBody + 1), LIMITS.chatBody), null);
});

test('cleanText rejects whitespace-only and non-strings', () => {
  assert.equal(cleanText('   ', 100), null);
  assert.equal(cleanText(42, 100), null);
  assert.equal(cleanText(null, 100), null);
});

test('cleanHandle lowercases and enforces shape', () => {
  assert.equal(cleanHandle('  VaibhavT '), 'vaibhavt');
  assert.equal(cleanHandle('abc'), 'abc');
  assert.equal(cleanHandle('-leading'), null);
  assert.equal(cleanHandle('trailing-'), null);
  assert.equal(cleanHandle('ab'), null); // 3-char minimum
  assert.equal(cleanHandle('has space'), null);
  assert.equal(cleanHandle('x'.repeat(40)), null);
});

test('cleanRepoUrl accepts https and rejects javascript:', () => {
  assert.equal(cleanRepoUrl('https://github.com/user/repo'), 'https://github.com/user/repo');
  assert.equal(cleanRepoUrl('javascript:alert(1)'), null);
  assert.equal(cleanRepoUrl('data:text/html,<script>'), null);
});

test('cleanRepoUrl rejects embedded credentials', () => {
  assert.equal(cleanRepoUrl('https://user:pass@github.com/x/y'), null);
});

test('cleanRepoUrl rejects unparseable input', () => {
  assert.equal(cleanRepoUrl('not a url'), null);
  assert.equal(cleanRepoUrl(''), null);
});

test('cleanRepoUrl accepts a custom max length for reuse (e.g. avatarUrl)', () => {
  const long = `https://example.com/${'a'.repeat(190)}`; // > LIMITS.repoUrl (200)
  assert.equal(cleanRepoUrl(long), null);
  assert.equal(cleanRepoUrl(long, LIMITS.avatarUrl), long);
});

test('cleanMultilineText preserves newlines — a skill is markdown, not a chat line', () => {
  const skill = 'name: my-skill\n\n## Steps\n1. do the thing\n2. verify it';
  assert.equal(cleanMultilineText(skill, 1000), skill);
});

test('cleanMultilineText collapses horizontal whitespace only', () => {
  assert.equal(cleanMultilineText('a   b\nc\t\td', 100), 'a b\nc d');
});

test('cleanMultilineText collapses excessive blank-line padding', () => {
  assert.equal(cleanMultilineText('a\n\n\n\n\n\nb', 100), 'a\n\nb');
});

test('cleanMultilineText strips bidi/control characters like cleanText', () => {
  assert.equal(cleanMultilineText('step \u202Ereverse-me\u0000!', 100), 'step reverse-me !');
});

test('cleanMultilineText rejects over-length, empty, and non-string input', () => {
  assert.equal(cleanMultilineText('x'.repeat(LIMITS.skillContent + 1), LIMITS.skillContent), null);
  assert.equal(cleanMultilineText('   \n  ', 100), null);
  assert.equal(cleanMultilineText(42, 100), null);
});

// --- githubRepo: the SSRF guard ---------------------------------------------

test('githubRepo accepts a real github repo url', () => {
  assert.deepEqual(githubRepo('https://github.com/Vaibhav91one/kerf'), { owner: 'Vaibhav91one', repo: 'kerf' });
  assert.deepEqual(githubRepo('https://github.com/Vaibhav91one/kerf.git'), { owner: 'Vaibhav91one', repo: 'kerf' });
  assert.deepEqual(githubRepo('https://github.com/a/b/tree/main'), { owner: 'a', repo: 'b' });
});

test('githubRepo rejects hosts that only look like github', () => {
  // Both of these pass an endsWith test, which is why the check is an exact compare.
  assert.equal(githubRepo('https://evilgithub.com/a/b'), null);
  assert.equal(githubRepo('https://github.com.attacker.tld/a/b'), null);
});

test('githubRepo rejects anything that is not https github.com', () => {
  assert.equal(githubRepo('http://github.com/a/b'), null);
  assert.equal(githubRepo('https://gitlab.com/a/b'), null);
  assert.equal(githubRepo('http://169.254.169.254/latest/meta-data/'), null);
  assert.equal(githubRepo('https://user:pass@github.com/a/b'), null);
  assert.equal(githubRepo('https://github.com/onlyowner'), null);
  assert.equal(githubRepo('not a url'), null);
  assert.equal(githubRepo(null), null);
});

// --- formatSkillLabel -------------------------------------------------------

test('formatSkillLabel strips packaging noise but keeps a typeable slug', () => {
  const cases: [string, string][] = [
    ['plugin_figma_figma', 'figma'],
    ['figma:figma-use', 'figma-use'],
    ['figma:figma-generate-diagram', 'figma-generate-diagram'],
    ['codex:setup', 'setup'],
    ['claude-in-chrome', 'claude-in-chrome'],
    ['chrome-devtools', 'chrome-devtools'],
    ['grill-me', 'grill-me'],
    ['batch', 'batch'],
  ];
  for (const [input, want] of cases) assert.equal(formatSkillLabel(input), want, input);
});

test('formatSkillLabel never returns an empty string', () => {
  assert.equal(formatSkillLabel(''), '');
  assert.equal(formatSkillLabel('plugin_'), 'plugin_');
  assert.equal(formatSkillLabel('x:'), 'x:');
});

// --- classifyTool -----------------------------------------------------------

test('classifyTool splits a skill key off its prefix', () => {
  assert.deepEqual(classifyTool('skill:caveman'), { kind: 'skill', label: 'caveman' });
});

test('classifyTool folds every tool of one MCP server onto the server name', () => {
  assert.deepEqual(classifyTool('mcp__serena__find_symbol'), { kind: 'mcp', label: 'serena' });
  assert.deepEqual(classifyTool('mcp__serena__replace_symbol_body'), { kind: 'mcp', label: 'serena' });
});

test('classifyTool splits on the FIRST __, so a server name may contain _', () => {
  // A greedy group swallows `plugin_figma_figma__whoami` up to the LAST `__`
  // and reports the label as `plugin_figma_figma__whoami`'s prefix instead.
  assert.deepEqual(classifyTool('mcp__plugin_figma_figma__whoami'), { kind: 'mcp', label: 'plugin_figma_figma' });
});

test('classifyTool calls a built-in tool a built-in', () => {
  assert.deepEqual(classifyTool('Bash'), { kind: 'builtin', label: 'Bash' });
  assert.deepEqual(classifyTool('Edit'), { kind: 'builtin', label: 'Edit' });
});

test('classifyTool does not treat a bare mcp-ish name as MCP', () => {
  assert.deepEqual(classifyTool('mcp__nodelimiter'), { kind: 'builtin', label: 'mcp__nodelimiter' });
});

// --- searchNeedle -----------------------------------------------------------

test('searchNeedle trims, lowercases and drops one leading @', () => {
  assert.equal(searchNeedle('  Ada '), 'ada');
  assert.equal(searchNeedle('@Ada'), 'ada');
});

test('searchNeedle drops only ONE @ — the second is part of what was typed', () => {
  assert.equal(searchNeedle('@@x'), '@x');
});

test('searchNeedle keeps an interior @ alone', () => {
  assert.equal(searchNeedle('a@b'), 'a@b');
});

test('searchNeedle of an empty box is empty', () => {
  assert.equal(searchNeedle('   '), '');
});
