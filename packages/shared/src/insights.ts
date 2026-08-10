// Numbers-only session insights for the dashboard — kerf-spec.md §6 privacy
// invariant applies here too: tips are template strings picked by comparing
// numbers already in SessionMetric/TierCuts, never by reading prompt/tool
// arguments. No I/O. Amendment F.

import type { SessionMetric } from './schema.ts';
import type { TierCuts } from './season.ts';

// A tip carries the rule that fired it. The Insights comp prints that rule next
// to the advice on purpose: every tip here is a threshold comparison on numbers
// already in SessionMetric, and saying so is what separates it from a model
// that read your transcripts.
export type Tip = { id: string; title: string; message: string; trigger: string };

export function improvementTips(metric: SessionMetric, cuts: TierCuts): Tip[] {
  const tips: Tip[] = [];

  if (metric.reworkRatio !== null && metric.reworkRatio > cuts.p80) {
    tips.push({
      id: 'high-rework',
      title: `Rework ratio ${metric.reworkRatio.toFixed(2)} in this session`,
      trigger: `triggered at ratio > p80 (${cuts.p80.toFixed(2)})`,
      message: 'Rework ratio is above your season p80 — try smaller, more targeted edits before re-touching a file.',
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
