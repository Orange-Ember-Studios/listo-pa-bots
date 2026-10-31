import type { APIRoute } from 'astro';
import { scan } from '../../scanner/index.js';

export const POST: APIRoute = async ({ request }) => {
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

  try {
    const result = await scan({ url });
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
