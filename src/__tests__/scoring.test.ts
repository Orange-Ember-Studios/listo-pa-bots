import { describe, it, expect } from 'vitest';
import { scoreScan, CHECK_WEIGHTS } from '../scoring/index.js';
import type { ScanOutput, CheckState } from '../scanner/types.js';

function buildScan(states: Record<string, CheckState>): ScanOutput {
  const checks = Object.entries(states).map(([id, state]) => ({
    id,
    state,
    detail: `detail for ${id}`,
    evidence: {},
  }));
  // Ensure all weighted checks are present.
  for (const id of Object.keys(CHECK_WEIGHTS)) {
    if (!checks.some((c) => c.id === id)) {
      checks.push({ id, state: 'fallo', detail: `missing ${id}`, evidence: {} });
    }
  }
  return {
    url: 'https://example.com/',
    date: new Date().toISOString(),
    checks,
  };
}

describe('scoreScan', () => {
  it('weights sum to 100', () => {
    const total = Object.values(CHECK_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBe(100);
  });

  it('returns 100 when all checks are ok', () => {
    const allOk = Object.fromEntries(Object.keys(CHECK_WEIGHTS).map((id) => [id, 'ok' as CheckState]));
    const result = scoreScan(buildScan(allOk));
    expect(result.score).toBe(100);
    expect(result.label).toBe('Listo Pa Bots');
  });

  it('returns 0 when all checks are fallo', () => {
    const allFallo = Object.fromEntries(Object.keys(CHECK_WEIGHTS).map((id) => [id, 'fallo' as CheckState]));
    const result = scoreScan(buildScan(allFallo));
    expect(result.score).toBe(0);
    expect(result.label).toBe('Invisible Pa Bots');
  });

  it('awards 50% credit for partial checks', () => {
    const partial = Object.fromEntries(
      Object.keys(CHECK_WEIGHTS).map((id) => [id, 'parcial' as CheckState])
    );
    const result = scoreScan(buildScan(partial));
    expect(result.score).toBe(50);
    expect(result.label).toBe('A medias');

    // Individual items are rounded; the total score must be 50.
    expect(result.score).toBe(50);
    for (const item of result.breakdown) {
      expect(item.earned).toBe(Math.round(item.max / 2));
    }
  });

  it('labels scores correctly', () => {
    expect(scoreScan(buildScan({ 'robots-txt': 'ok' })).label).toBe('Invisible Pa Bots');
    expect(
      scoreScan(
        buildScan({
          'robots-txt': 'ok',
          rendering: 'ok',
          'ai-manifest': 'ok',
          'llms-txt': 'ok',
        })
      ).label
    ).toBe('A medias');
  });
});
