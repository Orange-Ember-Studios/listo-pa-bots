import { describe, it, expect, beforeEach } from 'vitest';
import {
  SCAN_RATE_LIMIT,
  scanRateKey,
  scanDailyStatsKey,
  SCAN_TOTAL_STATS_KEY,
  checkScanRateLimit,
  recordScanAttempt,
  incrementScanStats,
  getScanTotalCount,
  sanitizeIP,
  type RateLimitKv,
} from '../lib/rate-limit.js';

class MockKv implements RateLimitKv {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string, _opts?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
  }

  count(key: string): number {
    return parseInt(this.store.get(key) ?? '0', 10);
  }
}

function requestWithIp(ip: string): Request {
  return new Request('https://example.com/api/scan', {
    headers: { 'cf-connecting-ip': ip },
  });
}

describe('rate limit constants', () => {
  it('has a 20 scans/hour limit', () => {
    expect(SCAN_RATE_LIMIT.maxPerHour).toBe(20);
    expect(SCAN_RATE_LIMIT.windowSeconds).toBe(3600);
  });
});

describe('scanRateKey', () => {
  it('includes sanitized IP and hour bucket', () => {
    const date = new Date('2026-10-31T14:25:00.000Z');
    expect(scanRateKey('1.2.3.4', date)).toBe('rate/scan/1.2.3.4/2026-10-31-14');
  });

  it('sanitizes unsafe characters', () => {
    expect(scanRateKey('a<b>c', new Date())).not.toContain('<');
    expect(scanRateKey('a<b>c', new Date())).not.toContain('>');
  });
});

describe('checkScanRateLimit', () => {
  let kv: MockKv;

  beforeEach(() => {
    kv = new MockKv();
  });

  it('allows requests below the limit', async () => {
    const request = requestWithIp('1.2.3.4');
    const result = await checkScanRateLimit(request, kv);
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBe(0);
  });

  it('blocks requests at the limit', async () => {
    const request = requestWithIp('1.2.3.4');
    const key = scanRateKey('1.2.3.4');
    await kv.put(key, String(SCAN_RATE_LIMIT.maxPerHour));
    const result = await checkScanRateLimit(request, kv);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(3600);
  });

  it('tracks different IPs independently', async () => {
    await recordScanAttempt(kv, requestWithIp('1.2.3.4'));
    await recordScanAttempt(kv, requestWithIp('1.2.3.4'));
    await recordScanAttempt(kv, requestWithIp('5.6.7.8'));

    expect(kv.count(scanRateKey('1.2.3.4'))).toBe(2);
    expect(kv.count(scanRateKey('5.6.7.8'))).toBe(1);
  });
});

describe('stats', () => {
  let kv: MockKv;

  beforeEach(() => {
    kv = new MockKv();
  });

  it('increments daily and total counters', async () => {
    await incrementScanStats(kv);
    await incrementScanStats(kv);

    expect(kv.count(scanDailyStatsKey())).toBe(2);
    expect(kv.count(SCAN_TOTAL_STATS_KEY)).toBe(2);
  });

  it('reads total count', async () => {
    await kv.put(SCAN_TOTAL_STATS_KEY, '42');
    expect(await getScanTotalCount(kv)).toBe(42);
  });

  it('returns 0 for missing total count', async () => {
    expect(await getScanTotalCount(kv)).toBe(0);
  });
});
