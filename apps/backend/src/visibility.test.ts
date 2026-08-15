import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleTo } from './visibility.ts';

test('an anonymous viewer sees public rows only', () => {
  assert.deepEqual(visibleTo(null), { isPublic: true });
});

test('a signed-in viewer sees public rows plus their own', () => {
  assert.deepEqual(visibleTo('ada'), { OR: [{ isPublic: true }, { handle: 'ada' }] });
});

// The narrowing must never widen to someone else's private rows: `handle` is the
// viewer's own, taken from their token, never from a param.
test('the owner branch is keyed on the viewer, not on the row', () => {
  const where = visibleTo('grace') as { OR: { handle?: string }[] };
  assert.equal(where.OR[1].handle, 'grace');
});
