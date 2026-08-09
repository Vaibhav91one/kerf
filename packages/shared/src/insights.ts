// Numbers-only session insights for the dashboard — kerf-spec.md §6 privacy
// invariant applies here too: tips are template strings picked by comparing
// numbers already in SessionMetric/TierCuts, never by reading prompt/tool
// arguments. No I/O. Amendment F.

import type { SessionMetric } from './schema.ts';
import type { TierCuts } from './season.ts';

export type Tip = { id: string; message: string };

export function improvementTips(metric: SessionMetric, cuts: TierCuts): Tip[] {
  const tips: Tip[] = [];

  if (metric.reworkRatio !== null && metric.reworkRatio > cuts.p80) {
    tips.push({
      id: 'high-rework',
      message: 'Rework ratio is above your season p80 — try smaller, more targeted edits before re-touching a file.',
    });
  }

  if (metric.turns <= 3 && metric.edits >= 5) {
    tips.push({
      id: 'low-planning',
      message: 'Few turns relative to edits — a short planning turn before editing tends to lower rework.',
    });
  }

  if (metric.edits > 0 && metric.editsRework === 0) {
    tips.push({
      id: 'clean-run',
      message: 'No rework this session — nice, this pattern is worth repeating.',
    });
  }

  return tips;
}
