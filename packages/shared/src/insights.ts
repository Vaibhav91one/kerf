// Numbers-only session insights for the dashboard — kerf-spec.md §6 privacy
// invariant applies here too: tips are template strings picked by comparing
// numbers already in SessionMetric, never by reading prompt/tool arguments.
// No I/O. Amendment F.
//
// Thresholds are fixed, not percentile-relative — season.ts's TierCuts went
// away with the points/level rework, and a fixed cut is exactly as readable
// for a single-session tip.

import type { SessionMetric } from './schema.ts';

// A tip carries the rule that fired it. The Insights comp prints that rule next
// to the advice on purpose: every tip here is a threshold comparison on numbers
// already in SessionMetric, and saying so is what separates it from a model
// that read your transcripts.
export type Tip = { id: string; title: string; message: string; trigger: string };

const HIGH_REWORK_THRESHOLD = 0.4;

export function improvementTips(metric: SessionMetric): Tip[] {
  const tips: Tip[] = [];

  if (metric.reworkRatio !== null && metric.reworkRatio > HIGH_REWORK_THRESHOLD) {
    tips.push({
      id: 'high-rework',
      title: `Rework ratio ${metric.reworkRatio.toFixed(2)} in this session`,
      trigger: `triggered at ratio > ${HIGH_REWORK_THRESHOLD.toFixed(2)}`,
      message: 'A lot of files got touched more than once — try smaller, more targeted edits before re-touching a file.',
    });
  }

  if (metric.turns <= 3 && metric.edits >= 5) {
    tips.push({
      id: 'low-planning',
      title: `${metric.edits} edits across ${metric.turns} turns`,
      trigger: 'triggered at turns <= 3 and edits >= 5',
      message: 'Few turns relative to edits — a short planning turn before editing tends to lower rework.',
    });
  }

  if (metric.edits > 0 && metric.editsRework === 0) {
    tips.push({
      id: 'clean-run',
      title: `${metric.edits} edits, nothing re-touched`,
      trigger: 'triggered at rework == 0 with at least 1 edit',
      message: 'No rework this session — nice, this pattern is worth repeating.',
    });
  }

  return tips;
}
