import type { ScanOutput } from '../scanner/types.js';

/**
 * Interfaz de lectura de snapshots de escaneo.
 *
 * En local los snapshots son JSON estáticos servidos desde /reports/.
 * En Cloudflare Workers se reemplazará por KV sin modificar la UI del informe.
 */
export interface ReportStore {
  get(id: string, origin: string): Promise<ScanOutput | null>;
}

const localHttpStore: ReportStore = {
  async get(id, origin) {
    if (!id || /[\\/]/.test(id)) return null;
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

export function getStore(): ReportStore {
  return localHttpStore;
}

export async function getReportById(id: string, origin: string): Promise<ScanOutput | null> {
  return getStore().get(id, origin);
}
