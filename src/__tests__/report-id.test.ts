import { describe, it, expect } from 'vitest';
import { makeReportId } from '../lib/reports.js';

describe('makeReportId', () => {
  it('strips www and formats id as host-iso', () => {
    const url = new URL('https://www.tunegocio.com/');
    const date = new Date('2026-10-31T14:30:00.000Z');
    expect(makeReportId(url, date)).toBe('tunegocio.com-2026-10-31T14-30-00');
  });

  it('works without www', () => {
    const url = new URL('https://example.com/path');
    const date = new Date('2026-01-02T03:04:05.000Z');
    expect(makeReportId(url, date)).toBe('example.com-2026-01-02T03-04-05');
  });
});
