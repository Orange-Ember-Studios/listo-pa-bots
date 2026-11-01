import type { ScanOutput } from '../scanner/types.js';
import { normalizeUrl } from '../scanner/types.js';
import { scoreScan } from '../scoring/index.js';

export function makeReportId(url: URL, date: Date): string {
  const host = url.hostname.replace(/^www\./, '');
  const iso = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${host}-${iso}`;
}

export interface ReportKv {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
  delete?: (key: string) => Promise<void>;
  list: (options?: { prefix?: string; limit?: number; cursor?: string }) => Promise<{
    keys: Array<{ name: string; expiration?: number; metadata?: unknown }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

export interface SnapshotPoint {
  id: string;
  key: string;
  snapshot: ScanOutput;
  score: number;
  date: Date;
}

export interface HistoryPoint {
  id: string;
  score: number;
  date: string; // ISO 8601
}

export async function saveSnapshot(kv: ReportKv, snapshot: ScanOutput): Promise<{ id: string; key: string }> {
  const target = normalizeUrl(snapshot.url);
  const id = makeReportId(target, new Date(snapshot.date));
  const key = `informe/${id}`;
  await kv.put(key, JSON.stringify(snapshot));
  return { id, key };
}

export async function getDomainSnapshots(
  kv: ReportKv,
  domain: string,
  limit: number = 12
): Promise<SnapshotPoint[]> {
  const normalized = domain.toLowerCase().replace(/^www\./, '');
  const prefix = `informe/${normalized}-`;
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix, limit: 100, cursor });
    for (const key of page.keys) {
      keys.push(key.name);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const points: SnapshotPoint[] = [];
  for (const key of keys) {
    const raw = await kv.get(key);
    if (!raw) continue;
    try {
      const snapshot = JSON.parse(raw) as ScanOutput;
      const scored = scoreScan(snapshot);
      const id = key.slice('informe/'.length);
      points.push({
        id,
        key,
        snapshot,
        score: scored.score,
        date: new Date(snapshot.date),
      });
    } catch {
      // skip malformed snapshots
    }
  }

  points.sort((a, b) => a.date.getTime() - b.date.getTime());
  return points.slice(-limit);
}

export function buildHistory(snapshots: SnapshotPoint[]): HistoryPoint[] {
  return snapshots.map((point) => ({
    id: point.id,
    score: point.score,
    date: point.snapshot.date,
  }));
}

export async function getDomainHistory(
  domain: string,
  _origin: string,
  limit: number = 12
): Promise<HistoryPoint[]> {
  const env = await getWorkersEnv();
  const kv = env?.REPORTS as ReportKv | undefined;
  if (!kv?.get || !kv?.list) return [];
  const snapshots = await getDomainSnapshots(kv, domain, limit);
  return buildHistory(snapshots);
}

/**
 * Interfaz de lectura de snapshots de escaneo.
 *
 * Orden de resolucion:
 * 1. Binding REPORTS (KV) para escaneos en vivo.
 * 2. Binding ASSETS (snapshots empaquetados en public/reports).
 * 3. Fetch HTTP (local).
 */
export interface ReportStore {
  get(id: string, origin: string): Promise<ScanOutput | null>;
}

function isValidId(id: string): boolean {
  return !!id && !/[\\/]/.test(id);
}

async function getWorkersEnv(): Promise<Record<string, unknown> | null> {
  try {
    const mod = (await import('cloudflare:workers')) as { env?: Record<string, unknown> };
    return mod.env ?? null;
  } catch {
    return null;
  }
}

const kvStore: ReportStore = {
  async get(id, origin) {
    if (!isValidId(id)) return null;
    try {
      const env = await getWorkersEnv();
      const kv = env?.REPORTS as { get?: (key: string) => Promise<string | null> } | undefined;
      if (!kv?.get) return null;
      const raw = await kv.get(`informe/${id}`);
      if (!raw) return null;
      return JSON.parse(raw) as ScanOutput;
    } catch {
      return null;
    }
  },
};

const assetsStore: ReportStore = {
  async get(id, origin) {
    if (!isValidId(id)) return null;
    try {
      const env = await getWorkersEnv();
      const assets = env?.ASSETS as { fetch: typeof fetch } | undefined;
      if (!assets) return null;
      const url = new URL(`/reports/${id}.json`, origin).toString();
      const response = await assets.fetch(new Request(url));
      if (!response.ok) return null;
      return (await response.json()) as ScanOutput;
    } catch {
      return null;
    }
  },
};

const localHttpStore: ReportStore = {
  async get(id, origin) {
    if (!isValidId(id)) return null;
    try {
      const url = `${origin}/reports/${id}.json`;
      const response = await fetch(url);
      if (!response.ok) return null;
      return (await response.json()) as ScanOutput;
    } catch {
      return null;
    }
  },
};

export async function getReportById(id: string, origin: string): Promise<ScanOutput | null> {
  const fromKv = await kvStore.get(id, origin);
  if (fromKv) return fromKv;

  const fromAssets = await assetsStore.get(id, origin);
  if (fromAssets) return fromAssets;

  return localHttpStore.get(id, origin);
}
