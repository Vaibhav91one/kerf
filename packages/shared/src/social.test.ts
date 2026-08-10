import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, cleanHandle, cleanMultilineText, cleanRepoUrl, cleanText } from './social.ts';

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
