import type { ScanOutput } from '../scanner/types.js';

export function makeReportId(url: URL, date: Date): string {
  const host = url.hostname.replace(/^www\./, '');
  const iso = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${host}-${iso}`;
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
