import type { ScanOutput, CheckResult, CheckState } from '../scanner/types.js';

export const CHECK_WEIGHTS: Record<string, number> = {
  'robots-txt': 35,
  'rendering': 25,
  'llms-txt': 15,
  'sitemap': 10,
  'headers': 15,
};

export const CHECK_LABELS: Record<string, string> = {
  'robots-txt': 'robots.txt segmentado',
  'rendering': 'SSR / contenido estático',
  'llms-txt': 'llms.txt',
  'sitemap': 'sitemap.xml',
  'headers': 'headers HTTP',
};

export interface ScoreBreakdownItem {
  id: string;
  name: string;
  state: CheckState;
  weight: number;
  earned: number;
  max: number;
  detail: string;
}

export interface ScoreResult {
  score: number;
  label: string;
  breakdown: ScoreBreakdownItem[];
  max: number;
}

function factorForState(state: CheckState): number {
  if (state === 'ok') return 1;
  if (state === 'parcial') return 0.5;
  return 0;
}

function labelForScore(score: number): string {
  if (score >= 80) return 'Listo Pa Bots';
  if (score >= 50) return 'A medias';
  return 'Invisible Pa Bots';
}

export function scoreScan(scan: ScanOutput): ScoreResult {
  const breakdown: ScoreBreakdownItem[] = [];
  let raw = 0;

  for (const check of scan.checks) {
    const weight = CHECK_WEIGHTS[check.id] ?? 0;
    const factor = factorForState(check.state);
    const earned = weight * factor;
    raw += earned;
    breakdown.push({
      id: check.id,
      name: CHECK_LABELS[check.id] ?? check.id,
      state: check.state,
      weight,
      earned: Math.round(earned),
      max: weight,
      detail: check.detail,
    });
  }

  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    score,
    label: labelForScore(score),
    breakdown,
    max: 100,
  };
}
