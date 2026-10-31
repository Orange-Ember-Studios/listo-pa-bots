import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { normalizeUrl } from '../../scanner/types.js';
import { scoreScan } from '../../scoring/index.js';
import { t, type Locale } from '../../i18n/index.js';

interface LeadRecord {
  id: string;
  url: string;
  name: string | null;
  email: string;
  plan: string;
  score_hint: number | null;
}

function getClientIP(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function emailSlug(email: string): string {
  return email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function getLatestScoreForDomain(domain: string): Promise<number | null> {
  try {
    const kv = env.REPORTS as { list?: (opts: { prefix: string }) => Promise<{ keys: { name: string }[] }>; get?: (key: string) => Promise<string | null> } | undefined;
    if (!kv?.list || !kv?.get) return null;
    const listed = await kv.list({ prefix: `informe/${domain}-` });
    if (!listed.keys || listed.keys.length === 0) return null;

    const sorted = [...listed.keys].sort((a, b) => b.name.localeCompare(a.name));
    const latestKey = sorted[0].name;
    const raw = await kv.get(latestKey);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as { url: string; date: string; checks: { id: string; state: string; detail: string; evidence: Record<string, unknown> }[] };
    const scored = scoreScan(snapshot as Parameters<typeof scoreScan>[0]);
    return scored.score;
  } catch {
    return null;
  }
}

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const locale: Locale = 'es';

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: t(locale, 'errors', 'invalidJson') }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const honeypot = body.website;
  if (honeypot !== undefined && honeypot !== null && String(honeypot).trim() !== '') {
    return new Response(JSON.stringify({ error: t(locale, 'errors', 'leadHoneypot') }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const url = body.url;
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

  const email = body.email;
  if (!email || typeof email !== 'string' || !isValidEmail(email)) {
    return new Response(JSON.stringify({ error: t(locale, 'errors', 'leadInvalidEmail') }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const planOptions = ['basica', 'completa', 'mcp', 'monitoring'];
  const plan = typeof body.plan === 'string' && planOptions.includes(body.plan) ? body.plan : 'basica';
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;

  const kv = env.LEADS as { get?: (key: string) => Promise<string | null>; put?: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void> } | undefined;
  if (!kv?.get || !kv?.put) {
    return new Response(JSON.stringify({ error: t(locale, 'errors', 'leadGeneric') }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const ip = getClientIP(request);
  const rateKey = `rate_limit/lead/${ip}`;
  const existing = await kv.get(rateKey);
  if (existing) {
    return new Response(JSON.stringify({ error: t(locale, 'errors', 'leadRateLimited') }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }

  const domain = target.hostname.replace(/^www\./, '');
  const scoreHint = await getLatestScoreForDomain(domain);

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const key = `lead/${timestamp}-${emailSlug(email)}`;

  const record: LeadRecord = {
    id,
    url: target.toString(),
    name,
    email: email.trim().toLowerCase(),
    plan,
    score_hint: scoreHint,
  };

  try {
    await kv.put(key, JSON.stringify(record));
    await kv.put(rateKey, '1', { expirationTtl: 3600 });
  } catch {
    return new Response(JSON.stringify({ error: t(locale, 'errors', 'leadGeneric') }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ id, status: 'stored' }, null, 2), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
