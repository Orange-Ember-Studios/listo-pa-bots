import { describe, it, expect } from 'vitest';
import { getLatestSnapshotIdForDomain, type BadgeKv } from '../lib/badge.js';

function createBadgeKv(keys: string[]): BadgeKv {
  return {
    list: async ({ prefix }) => ({
      keys: keys
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name })),
    }),
    get: async (key) => {
      if (keys.includes(key)) return JSON.stringify({ url: 'https://example.com/', date: new Date().toISOString(), checks: [] });
      return null;
    },
  };
}

describe('getLatestSnapshotIdForDomain', () => {
  it('returns null when no snapshots exist', async () => {
    const kv = createBadgeKv([]);
    const result = await getLatestSnapshotIdForDomain(kv, 'example.com');
    expect(result.id).toBeNull();
  });

  it('selects the lexicographically largest key for the domain', async () => {
    const kv = createBadgeKv([
      'informe/example.com-2026-10-30T12-00-00',
      'informe/example.com-2026-10-31T12-00-00',
      'informe/example.com-2026-10-31T13-00-00',
      'informe/other.com-2026-10-31T14-00-00',
    ]);
    const result = await getLatestSnapshotIdForDomain(kv, 'example.com');
    expect(result.id).toBe('example.com-2026-10-31T13-00-00');
  });

  it('does not match keys from other domains', async () => {
    const kv = createBadgeKv(['informe/other.com-2026-10-31T12-00-00']);
    const result = await getLatestSnapshotIdForDomain(kv, 'example.com');
    expect(result.id).toBeNull();
  });
});
