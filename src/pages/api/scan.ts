import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { format, t, type Locale } from '../../i18n/index.js';
import { scan } from '../../scanner/index.js';
import { normalizeUrl } from '../../scanner/types.js';
import { scoreScan } from '../../scoring/index.js';
import { makeReportId } from '../../lib/reports.js';
import {
  checkScanRateLimit,
  incrementScanStats,
  recordScanAttempt,
  type RateLimitKv,
} from '../../lib/rate-limit.js';

export const prerender = false;

function informeUrl(origin: string, id: string, locale: Locale): string {
  const prefix = locale === 'en' ? '/en' : '';
  return `${origin}${prefix}/informe/${id}`;
}

function getReportsKv(): RateLimitKv | null {
  const kv = env.REPORTS as { get?: (key: string) => Promise<string | null>; put?: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void> } | undefined;
  if (!kv?.get || !kv?.put) return null;
  return kv as RateLimitKv;
}

export const POST: APIRoute = async ({ request }) => {
  let url: string | undefined;
  let requestedLang: string | undefined;
  try {
    const body = await request.json();
    url = body.url;
    requestedLang = body.lang;
  } catch {
    return new Response(JSON.stringify({ error: t('es', 'errors', 'invalidJson') }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const locale: Locale = requestedLang === 'en' || requestedLang === 'es' ? requestedLang : 'es';

  if (!url || typeof url !== 'string') {
    return new Response(JSON.stringify({ error: t(locale, 'errors', 'missingUrl') }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  let target: URL;
  try {
    target = normalizeUrl(url);
  } catch {
    return new Response(JSON.stringify({ error: t(locale, 'errors', 'invalidUrl') }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const kv = getReportsKv();
  if (kv) {
    const limit = await checkScanRateLimit(request, kv);
    if (!limit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'rate_limited',
          retry_after_seconds: limit.retryAfter,
          message: t(locale, 'landing', 'rateLimitedError'),
        }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': String(limit.retryAfter),
          },
        }
      );
    }
  }

  try {
    const snapshot = await scan({ url: target.toString() });
    const scored = scoreScan(snapshot);
    const id = makeReportId(target, new Date(snapshot.date));
    const key = `informe/${id}`;

    if (kv) {
      await recordScanAttempt(kv, request);
      await incrementScanStats(kv);
      await kv.put(key, JSON.stringify(snapshot));
    }

    const origin = new URL(request.url).origin;
    const informeUrlValue = informeUrl(origin, id, locale);

    return new Response(
      JSON.stringify(
        {
          id,
          score: scored.score,
          label: scored.label,
          informe_url: informeUrlValue,
        },
        null,
        2
      ),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  } catch (err) {
    const message = (err as Error).message || 'Error desconocido';
    const isTimeout = message.toLowerCase().includes('timeout');
    return new Response(
      JSON.stringify({
        error: isTimeout
          ? t(locale, 'errors', 'scanTimeout')
          : format(t(locale, 'errors', 'scanFailed'), { message }),
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
};
