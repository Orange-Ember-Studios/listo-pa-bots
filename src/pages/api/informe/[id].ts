import type { APIRoute } from 'astro';
import { getReportById } from '../../../lib/reports.js';
import { scoreScan } from '../../../scoring/index.js';

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Informe no encontrado' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  const snapshot = await getReportById(id, new URL(url).origin);
  if (!snapshot) {
    return new Response(JSON.stringify({ error: 'Informe no encontrado' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  const scored = scoreScan(snapshot);

  return new Response(
    JSON.stringify(
      {
        id,
        url: snapshot.url,
        date: snapshot.date,
        score: scored.score,
        label: scored.label,
        breakdown: scored.breakdown,
      },
      null,
      2
    ),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }
  );
};
