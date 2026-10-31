import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { format, t, type Locale } from '../../i18n/index.js';
import { scan } from '../../scanner/index.js';
import { normalizeUrl } from '../../scanner/types.js';
import { scoreScan } from '../../scoring/index.js';

function makeId(url: URL, date: Date): string {
  const host = url.hostname.replace(/^www\./, '');
  const iso = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${host}-${iso}`;
}

function informeUrl(origin: string, id: string, locale: Locale): string {
  const prefix = locale === 'en' ? '/en' : '';
  return `${origin}${prefix}/informe/${id}`;
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

  try {
    const snapshot = await scan({ url: target.toString() });
    const scored = scoreScan(snapshot);
    const id = makeId(target, new Date(snapshot.date));
    const key = `informe/${id}`;

    const kv = env.REPORTS as { put?: (key: string, value: string) => Promise<void> } | undefined;
    if (kv?.put) {
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
