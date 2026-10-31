import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { scan } from '../../scanner/index.js';
import { normalizeUrl } from '../../scanner/types.js';
import { scoreScan } from '../../scoring/index.js';

function makeId(url: URL, date: Date): string {
  const host = url.hostname.replace(/^www\./, '');
  const iso = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${host}-${iso}`;
}

export const POST: APIRoute = async ({ request, locals }) => {
  let url: string | undefined;
  try {
    const body = await request.json();
    url = body.url;
  } catch {
    return new Response(JSON.stringify({ error: 'El cuerpo debe ser JSON válido' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!url || typeof url !== 'string') {
    return new Response(JSON.stringify({ error: 'Se requiere el campo "url"' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  let target: URL;
  try {
    target = normalizeUrl(url);
  } catch {
    return new Response(JSON.stringify({ error: 'La URL no es válida. Prueba con https://tusitio.com' }), {
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
    const informeUrl = `${origin}/informe/${id}`;

    return new Response(
      JSON.stringify(
        {
          id,
          score: scored.score,
          label: scored.label,
          informe_url: informeUrl,
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
          ? 'El escaneo tardó demasiado. Intenta de nuevo en unos segundos.'
          : `No pudimos escanear el sitio: ${message}`,
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
};
