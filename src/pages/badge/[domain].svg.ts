import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { scoreScan } from '../../scoring/index.js';
import { getLatestSnapshotIdForDomain, type BadgeKv } from '../../lib/badge.js';

function scoreColor(score: number): string {
  if (score >= 80) return '#34d399';
  if (score >= 50) return '#f5a623';
  return '#f87171';
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function getLatestScore(domain: string): Promise<{ score: number | null; reportUrl: string | null }> {
  try {
    const kv = env.REPORTS as BadgeKv | undefined;
    if (!kv) return { score: null, reportUrl: null };

    const { key, id } = await getLatestSnapshotIdForDomain(kv, domain);
    if (!key || !id) return { score: null, reportUrl: null };

    const raw = await kv.get(key);
    if (!raw) return { score: null, reportUrl: null };

    const snapshot = JSON.parse(raw) as Parameters<typeof scoreScan>[0];
    const scored = scoreScan(snapshot);
    return { score: scored.score, reportUrl: `/informe/${id}` };
  } catch {
    return { score: null, reportUrl: null };
  }
}

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const domain = typeof params.domain === 'string' ? decodeURIComponent(params.domain) : '';
  const origin = new URL(request.url).origin;

  const { score, reportUrl } = await getLatestScore(domain);
  const hasScore = score !== null;
  const rightColor = hasScore ? scoreColor(score) : '#6b7280';
  const label = hasScore ? `${score}/100` : 'sin escaneo';
  const link = hasScore && reportUrl ? `${origin}${reportUrl}` : origin;

  const width = 200;
  const height = 56;
  const leftWidth = 120;
  const rightWidth = width - leftWidth;
  const radius = 8;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Listo Pa Bots ${escapeXml(label)}">
  <a xlink:href="${escapeXml(link)}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#1f2937"/>
    <rect x="0" y="0" width="${leftWidth}" height="${height}" rx="${radius}" ry="${radius}" fill="#111827"/>
    <rect x="${leftWidth - radius}" y="0" width="${radius * 2}" height="${height}" fill="#111827"/>
    <rect x="${leftWidth}" y="0" width="${rightWidth}" height="${height}" rx="${radius}" ry="${radius}" fill="${rightColor}"/>
    <rect x="${leftWidth}" y="0" width="${radius}" height="${height}" fill="${rightColor}"/>
    <text x="${leftWidth / 2}" y="${height / 2 + 1}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="13" font-weight="700" fill="#f9fafb" text-anchor="middle" dominant-baseline="middle">Listo Pa Bots</text>
    <text x="${leftWidth + rightWidth / 2}" y="${height / 2 + 1}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="14" font-weight="800" fill="#111827" text-anchor="middle" dominant-baseline="middle">${escapeXml(label)}</text>
  </a>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
};
