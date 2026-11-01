import { describe, it, expect, beforeEach } from 'vitest';
import type { ScanOutput } from '../scanner/types.js';
import {
  isMonitorDue,
  getPreviousSnapshot,
  runMonitors,
  addMonitor,
  removeMonitor,
  listMonitored,
  normalizeDomain,
  buildHistory,
  type MonitoredDomain,
  type MonitorKv,
} from '../lib/monitor.js';
import type { SnapshotPoint } from '../lib/reports.js';

class MockKv implements MonitorKv {
  private store = new Map<string, string>();
  deleted = new Set<string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string, _opts?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
    this.deleted.delete(key);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.deleted.add(key);
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string; expiration?: number; metadata?: unknown }>;
    list_complete: boolean;
    cursor?: string;
  }> {
    const prefix = options?.prefix ?? '';
    const limit = options?.limit ?? 100;
    const keys = Array.from(this.store.keys())
      .filter((k) => k.startsWith(prefix))
      .map((name) => ({ name }));
    const start = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const page = keys.slice(start, start + limit);
    const next = start + page.length;
    return {
      keys: page,
      list_complete: next >= keys.length,
      cursor: next >= keys.length ? undefined : String(next),
    };
  }

  value(key: string): string | undefined {
    return this.store.get(key);
  }
}

function makeSnapshot(url: string, date: string, scoreBase: number): ScanOutput {
  // 5 weighted checks: robots-txt(35), rendering(25), llms-txt(15), headers(15), sitemap(10)
  const ok = (id: string) => ({ id, state: 'ok' as const, detail: 'ok', evidence: {} });
  const fallo = (id: string) => ({ id, state: 'fallo' as const, detail: 'fallo', evidence: {} });
  const checks = [
    scoreBase >= 35 ? ok('robots-txt') : fallo('robots-txt'),
    scoreBase >= 60 ? ok('rendering') : fallo('rendering'),
    scoreBase >= 75 ? ok('llms-txt') : fallo('llms-txt'),
    scoreBase >= 90 ? ok('headers') : fallo('headers'),
    scoreBase >= 100 ? ok('sitemap') : fallo('sitemap'),
  ];
  return { url, date, checks };
}

function snapshotPoint(id: string, snapshot: ScanOutput, score: number): SnapshotPoint {
  return {
    id,
    key: `informe/${id}`,
    snapshot,
    score,
    date: new Date(snapshot.date),
  };
}

describe('normalizeDomain', () => {
  it('strips scheme and www', () => {
    expect(normalizeDomain('https://www.orangeember.com/')).toBe('orangeember.com');
    expect(normalizeDomain('orangeember.com')).toBe('orangeember.com');
    expect(normalizeDomain('http://OrangeEmber.com')).toBe('orangeember.com');
  });

  it('throws on invalid url', () => {
    expect(() => normalizeDomain('not a url')).toThrow('invalid_url');
  });
});

describe('isMonitorDue', () => {
  const weekly: MonitoredDomain = { frequency: 'weekly', plan: 'basic', added: '2026-01-01T00:00:00.000Z' };
  const monthly: MonitoredDomain = { frequency: 'monthly', plan: 'basic', added: '2026-01-01T00:00:00.000Z' };

  it('is due when there is no last_scan', () => {
    expect(isMonitorDue(weekly, new Date('2026-02-01T00:00:00.000Z'))).toBe(true);
  });

  it('is not due when weekly scan happened one day ago', () => {
    const record = { ...weekly, last_scan: '2026-02-01T00:00:00.000Z' };
    expect(isMonitorDue(record, new Date('2026-02-02T00:00:00.000Z'))).toBe(false);
    const record2 = { ...weekly, last_scan: '2026-02-02T00:00:00.000Z' };
    expect(isMonitorDue(record2, new Date('2026-02-03T00:00:00.000Z'))).toBe(false);
    const record3 = { ...weekly, last_scan: '2026-02-02T12:00:00.000Z' };
    expect(isMonitorDue(record3, new Date('2026-02-03T00:00:00.000Z'))).toBe(false);
    const record4 = { ...weekly, last_scan: '2026-02-02T00:00:00.000Z' };
    expect(isMonitorDue(record4, new Date('2026-02-02T01:00:00.000Z'))).toBe(false);
  });

  it('is due when weekly threshold is exceeded', () => {
    const record = { ...weekly, last_scan: '2026-02-01T00:00:00.000Z' };
    expect(isMonitorDue(record, new Date('2026-02-09T00:00:01.000Z'))).toBe(true);
  });

  it('is not due when monthly scan happened 29 days ago', () => {
    const record = { ...monthly, last_scan: '2026-02-01T00:00:00.000Z' };
    expect(isMonitorDue(record, new Date('2026-03-02T00:00:00.000Z'))).toBe(false);
  });

  it('is due when monthly threshold is exceeded', () => {
    const record = { ...monthly, last_scan: '2026-02-01T00:00:00.000Z' };
    expect(isMonitorDue(record, new Date('2026-03-03T00:00:01.000Z'))).toBe(true);
  });
});

describe('getPreviousSnapshot', () => {
  it('returns the most recent snapshot before the current date', () => {
    const points = [
      snapshotPoint('a', makeSnapshot('https://example.com', '2026-02-01T00:00:00.000Z', 35), 35),
      snapshotPoint('b', makeSnapshot('https://example.com', '2026-02-02T00:00:00.000Z', 60), 60),
      snapshotPoint('c', makeSnapshot('https://example.com', '2026-02-03T00:00:00.000Z', 75), 75),
    ];
    const previous = getPreviousSnapshot(new Date('2026-02-03T00:00:00.000Z'), points);
    expect(previous?.id).toBe('b');
  });

  it('ignores snapshots with the same timestamp as current', () => {
    const points = [
      snapshotPoint('a', makeSnapshot('https://example.com', '2026-02-01T00:00:00.000Z', 35), 35),
      snapshotPoint('b', makeSnapshot('https://example.com', '2026-02-02T00:00:00.000Z', 60), 60),
    ];
    const previous = getPreviousSnapshot(new Date('2026-02-02T00:00:00.000Z'), points);
    expect(previous?.id).toBe('a');
  });

  it('returns undefined when there is no previous snapshot', () => {
    const points = [snapshotPoint('a', makeSnapshot('https://example.com', '2026-02-01T00:00:00.000Z', 35), 35)];
    expect(getPreviousSnapshot(new Date('2026-02-01T00:00:00.000Z'), points)).toBeUndefined();
  });
});

describe('runMonitors', () => {
  let kv: MockKv;

  beforeEach(() => {
    kv = new MockKv();
  });

  it('scans due domains and skips non-due domains', async () => {
    await addMonitor(kv, 'https://due.example.com', 'weekly');
    await addMonitor(kv, 'https://recent.example.com', 'weekly');
    await kv.put(
      'monitored/recent.example.com',
      JSON.stringify({
        frequency: 'weekly',
        plan: 'basic',
        added: '2026-01-01T00:00:00.000Z',
        last_scan: '2026-02-01T00:00:00.000Z',
      })
    );

    const scanner = (input: { url: string }) => {
      if (input.url.includes('due')) return Promise.resolve(makeSnapshot('https://due.example.com', '2026-02-02T00:00:00.000Z', 60));
      return Promise.resolve(makeSnapshot('https://recent.example.com', '2026-02-02T00:00:00.000Z', 60));
    };

    const summary = await runMonitors(kv, scanner, undefined, new Date('2026-02-02T00:00:00.000Z'));
    expect(summary.ran).toBe(1);
    expect(summary.results[0].domain).toBe('due.example.com');

    const monitored = await listMonitored(kv);
    const dueRecord = monitored.find((m) => m.domain === 'due.example.com')?.record;
    expect(dueRecord?.last_scan).toBe('2026-02-02T00:00:00.000Z');
  });

  it('computes positive delta and no alert when score improves', async () => {
    await addMonitor(kv, 'https://improving.example.com', 'weekly');
    const old = makeSnapshot('https://improving.example.com', '2026-02-01T00:00:00.000Z', 35);
    await kv.put(`informe/improving.example.com-2026-02-01T00-00-00`, JSON.stringify(old));

    const scanner = () => Promise.resolve(makeSnapshot('https://improving.example.com', '2026-02-08T00:00:00.000Z', 75));
    const summary = await runMonitors(kv, scanner, undefined, new Date('2026-02-08T00:00:00.000Z'));

    expect(summary.results[0].delta).toBeGreaterThan(0);
    expect(summary.results[0].alert).toBe(false);
  });

  it('computes negative delta, writes alert key and calls emailer', async () => {
    await addMonitor(kv, 'https://dropping.example.com', 'weekly');
    const old = makeSnapshot('https://dropping.example.com', '2026-02-01T00:00:00.000Z', 75);
    await kv.put(`informe/dropping.example.com-2026-02-01T00-00-00`, JSON.stringify(old));

    const sent: Array<{ domain: string; delta: number }> = [];
    const emailer = {
      sendAlert: async (opts: { domain: string; previous: number; score: number; delta: number; date: Date }) => {
        sent.push(opts);
      },
    };

    const scanner = () => Promise.resolve(makeSnapshot('https://dropping.example.com', '2026-02-08T00:00:00.000Z', 35));
    const summary = await runMonitors(kv, scanner, emailer, new Date('2026-02-08T00:00:00.000Z'));

    const result = summary.results[0];
    expect(result.delta).toBeLessThan(0);
    expect(result.alert).toBe(true);
    expect(sent.length).toBe(1);
    expect(sent[0].domain).toBe('dropping.example.com');

    const alertKeys = (await kv.list({ prefix: 'alert/' })).keys.map((k) => k.name);
    expect(alertKeys.length).toBe(1);
  });

  it('is idempotent: a domain scanned today is not re-scanned', async () => {
    await addMonitor(kv, 'https://today.example.com', 'weekly');
    const scanner = () => Promise.resolve(makeSnapshot('https://today.example.com', '2026-02-01T00:00:00.000Z', 60));

    const first = await runMonitors(kv, scanner, undefined, new Date('2026-02-01T00:00:00.000Z'));
    expect(first.ran).toBe(1);

    const second = await runMonitors(kv, scanner, undefined, new Date('2026-02-01T12:00:00.000Z'));
    expect(second.ran).toBe(0);
  });
});

describe('removeMonitor', () => {
  it('removes an existing monitored domain', async () => {
    const kv = new MockKv();
    await addMonitor(kv, 'https://gone.example.com', 'weekly');
    const removed = await removeMonitor(kv, 'https://gone.example.com');
    expect(removed.removed).toBe(true);
    expect(kv.value('monitored/gone.example.com')).toBeUndefined();
  });

  it('returns removed false when domain is not monitored', async () => {
    const kv = new MockKv();
    const removed = await removeMonitor(kv, 'https://missing.example.com');
    expect(removed.removed).toBe(false);
  });
});

describe('buildHistory', () => {
  it('aggregates snapshot points into history points', () => {
    const points = [
      snapshotPoint('a', makeSnapshot('https://example.com', '2026-02-01T00:00:00.000Z', 35), 35),
      snapshotPoint('b', makeSnapshot('https://example.com', '2026-02-02T00:00:00.000Z', 75), 75),
    ];
    const history = buildHistory(points);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ id: 'a', score: 35, date: '2026-02-01T00:00:00.000Z' });
    expect(history[1]).toEqual({ id: 'b', score: 75, date: '2026-02-02T00:00:00.000Z' });
  });
});
