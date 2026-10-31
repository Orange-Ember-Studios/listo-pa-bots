import type { CheckFn, CheckResult, CheckState } from '../types.js';
import { fetchText, withTimeout, DEFAULT_TIMEOUT_MS } from '../utils.js';

const COMMON_SITEMAP_PATHS = ['/sitemap.xml', '/sitemap_index.xml', '/sitemaps.xml'];

interface SitemapEntry {
  loc: string;
  status?: number;
  error?: string;
}

function parseSitemap(text: string): { urls: string[]; valid: boolean; error?: string } {
  const urls: string[] = [];
  try {
    const locMatches = text.matchAll(/<loc>([\s\S]*?)<\/loc>/gi);
    for (const match of locMatches) {
      const loc = match[1].trim();
      if (loc) urls.push(loc);
    }
    const valid = urls.length > 0 || /\<\?xml|\<urlset|\<sitemapindex/i.test(text);
    return { urls, valid };
  } catch (err) {
    return { urls, valid: false, error: (err as Error).message };
  }
}

async function probeEntry(url: string): Promise<SitemapEntry> {
  try {
    const { response } = await fetchText(url, {}, 5_000);
    return { loc: url, status: response.status };
  } catch (err) {
    return { loc: url, error: (err as Error).message };
  }
}

export const checkSitemap: CheckFn = async (ctx) => {
  let checkedText: string | undefined;
  let checkedStatus = 0;
  let checkedUrl: string | undefined;

  for (const path of COMMON_SITEMAP_PATHS) {
    const url = new URL(path, ctx.origin).toString();
    try {
      const { response, text } = await fetchText(url);
      if (response.status === 200 && text.trim().length > 0) {
        checkedUrl = url;
        checkedStatus = response.status;
        checkedText = text;
        break;
      }
    } catch {
      // ignore individual failures and try next variant
    }
  }

  if (!checkedText) {
    return {
      id: 'sitemap',
      state: 'fallo',
      detail: 'No se encontró un sitemap.xml válido',
      evidence: { searchedLocations: COMMON_SITEMAP_PATHS },
    };
  }

  const parsed = parseSitemap(checkedText);
  if (!parsed.valid) {
    return {
      id: 'sitemap',
      state: 'fallo',
      detail: 'El sitemap encontrado no tiene formato XML válido',
      evidence: { url: checkedUrl, status: checkedStatus, parseError: parsed.error },
    };
  }

  const sample = parsed.urls.slice(0, 5);
  const probes = await Promise.all(sample.map((url) => probeEntry(url)));
  const failures = probes.filter((p) => !p.status || p.status >= 400).length;

  let state: CheckState;
  let detail: string;
  if (failures === 0) {
    state = 'ok';
    detail = `Sitemap válido con ${parsed.urls.length} URL(s); ${sample.length} entrada(s) de muestra responden correctamente`;
  } else {
    state = 'parcial';
    detail = `Sitemap válido con ${parsed.urls.length} URL(s), pero ${failures} entrada(s) de muestra fallan`;
  }

  return {
    id: 'sitemap',
    state,
    detail,
    evidence: {
      url: checkedUrl,
      status: checkedStatus,
      totalUrls: parsed.urls.length,
      sample: probes,
      firstUrls: parsed.urls.slice(0, 10),
    },
  };
};
