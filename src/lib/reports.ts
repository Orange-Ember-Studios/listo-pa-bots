import type { ScanOutput } from '../scanner/types.js';

/**
 * Interfaz de lectura de snapshots de escaneo.
 *
 * En local los snapshots son JSON estaticos servidos desde /reports/.
 * En Cloudflare Workers se leen directamente del binding ASSETS.
 */
export interface ReportStore {
  get(id: string, origin: string): Promise<ScanOutput | null>;
}

function isValidId(id: string): boolean {
  return !!id && !/[\\/]/.test(id);
}

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

const assetsStore: ReportStore = {
  async get(id, origin) {
    if (!isValidId(id)) return null;
    try {
      const { env } = await import('cloudflare:workers');
      const assets = (env as unknown as { ASSETS?: { fetch: typeof fetch } }).ASSETS;
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

async function hasAssetsBinding(): Promise<boolean> {
  try {
    const { env } = await import('cloudflare:workers');
    const assets = (env as unknown as { ASSETS?: { fetch: typeof fetch } }).ASSETS;
    return typeof assets?.fetch === 'function';
  } catch {
    return false;
  }
}

export function getStore(assets?: { fetch: typeof fetch }): ReportStore {
  return assets ? assetsStore : localHttpStore;
}

export async function getReportById(id: string, origin: string): Promise<ScanOutput | null> {
  // En produccion (Workers) leemos del binding ASSETS; en local usamos HTTP.
  if (await hasAssetsBinding()) {
    return assetsStore.get(id, origin);
  }
  return localHttpStore.get(id, origin);
}
