import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDeviceCode, generateUserCode, normalizeUserCode } from './device-code.ts';

const USER_CODE_RE = /^[0-9A-HJ-NP-TV-Z]{4}-[0-9A-HJ-NP-TV-Z]{4}$/;

test('generateUserCode produces an 8-character code from the restricted alphabet, grouped', () => {
  for (let i = 0; i < 20; i++) {
    assert.match(generateUserCode(), USER_CODE_RE);
  }
});

test('generateUserCode excludes easily-confused characters', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateUserCode();
    assert.doesNotMatch(code, /[ILOU]/);
  }
});

test('generateDeviceCode is high-entropy and URL-safe', () => {
  const code = generateDeviceCode();
  // 18 bytes base64url-encoded, no padding.
  assert.equal(code.length, 24);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(code, generateDeviceCode());
});

test('normalizeUserCode uppercases and re-inserts the dash', () => {
  assert.equal(normalizeUserCode('wdjb mjht'), 'WDJB-MJHT');
  assert.equal(normalizeUserCode('wdjbmjht'), 'WDJB-MJHT');
  assert.equal(normalizeUserCode('  WDJB-MJHT  '), 'WDJB-MJHT');
});

test('normalizeUserCode leaves a wrong-length code unformatted rather than guessing', () => {
  assert.equal(normalizeUserCode('WDJB'), 'WDJB');
  assert.equal(normalizeUserCode(''), '');
});
