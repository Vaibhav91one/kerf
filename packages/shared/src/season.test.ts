import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonScore, tierCuts, tierForValue } from './season.ts';

test('seasonScore is the median, unaffected by a winsorised outlier', () => {
  // same array length in both cases — the outlier replaces the max, so the
  // median index (2) never touches it either way.
  const withOutlier = seasonScore([0.1, 0.2, 0.3, 0.4, 100]);
  const withoutOutlier = seasonScore([0.1, 0.2, 0.3, 0.4, 0.5]);
  assert.equal(withOutlier, withoutOutlier);
});

test('tierForValue: lower-is-better inverts the ladder', () => {
  const cuts = tierCuts([0.1, 0.2, 0.3, 0.4, 0.5]);
  assert.equal(tierForValue(0.1, cuts, false), 'Diamond');
  assert.equal(tierForValue(0.5, cuts, false), 'Bronze');
});

test('tierForValue: higher-is-better is the default ladder direction', () => {
  const cuts = tierCuts([0.1, 0.2, 0.3, 0.4, 0.5]);
  assert.equal(tierForValue(0.5, cuts), 'Diamond');
  assert.equal(tierForValue(0.1, cuts), 'Bronze');
});
