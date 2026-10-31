import type { ScanInput, ScanOutput, ScanContext, CheckResult } from './types.js';
import { normalizeUrl } from './types.js';
import { fetchText, withTimeout, DEFAULT_TIMEOUT_MS } from './utils.js';
import { checkRobots, checkLlms, checkSitemap, checkHeaders, checkRendering } from './checks/index.js';

const CHECKS = [checkRobots, checkLlms, checkSitemap, checkHeaders, checkRendering];

export async function scan(input: ScanInput): Promise<ScanOutput> {
  const target = normalizeUrl(input.url);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const { response, text } = await withTimeout(
    fetch(target.toString(), { redirect: 'follow' }),
    timeoutMs,
    'home page'
  ).then(async (res) => ({ response: res, text: await res.text() }));

  const ctx: ScanContext = {
    target,
    origin: target.origin,
    home: { response, html: text },
  };

  const results = await Promise.all(
    CHECKS.map(async (check) => {
      try {
        return await withTimeout(check(ctx), timeoutMs, check.name || 'check');
      } catch (err) {
        return {
          id: check.name || 'unknown',
          state: 'fallo' as const,
          detail: `El check falló con error: ${(err as Error).message}`,
          evidence: { error: (err as Error).message },
        };
      }
    })
  );

  return {
    url: target.toString(),
    date: new Date().toISOString(),
    checks: results,
  };
}

export { checkRobots, checkLlms, checkSitemap, checkHeaders, checkRendering };
export * from './types.js';
