import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { scan } from '../../scanner/index.js';
import {
  addMonitor,
  removeMonitor,
  listMonitored,
  runMonitors,
  type MonitorKv,
  type MonitorFrequency,
  type Emailer,
} from '../../lib/monitor.js';

export const prerender = false;

const ADMIN_EMAIL_DEFAULT = 'ing.jose.joya@gmail.com';

function getKv(): MonitorKv | null {
  const kv = env.REPORTS as MonitorKv | undefined;
  if (!kv?.get || !kv?.put || !kv?.list) return null;
  return kv;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isValidFrequency(value: unknown): value is MonitorFrequency {
  return value === 'weekly' || value === 'monthly';
}

function createEmailer(resendKey: string, adminEmail: string): Emailer {
  return {
    async sendAlert({ domain, previous, score, delta }) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: adminEmail,
          subject: `Alerta Listo Pa Bots: ${domain} bajó ${Math.abs(delta)} pts`,
          text: `El puntaje de ${domain} bajó de ${previous} a ${score} (delta ${delta}). Revisa el informe en listopabots.orangeember.com.`,
        }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => 'unknown');
        throw new Error(`resend ${response.status}: ${text}`);
      }
    },
  };
}

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization') ?? '';
  const expected = typeof env.ADMIN_TOKEN === 'string' ? env.ADMIN_TOKEN : '';
  if (!expected || !auth.startsWith('Bearer ') || auth.slice(7) !== expected) {
    return unauthorized();
  }

  const kv = getKv();
  if (!kv) {
    return jsonResponse({ error: 'reports_kv_not_available' }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const action = body.action;
  if (action === 'list') {
    const items = await listMonitored(kv);
    return jsonResponse({
      count: items.length,
      items: items.map(({ domain, record }) => ({ domain, ...record })),
    });
  }

  if (action === 'add') {
    const url = typeof body.url === 'string' ? body.url : undefined;
    const frequency = isValidFrequency(body.frequency) ? body.frequency : undefined;
    if (!url || !frequency) {
      return jsonResponse({ error: 'missing_url_or_frequency' }, 400);
    }
    try {
      const { domain } = await addMonitor(kv, url, frequency);
      return jsonResponse({ added: true, domain });
    } catch (err) {
      const message = (err as Error).message || 'unknown';
      return jsonResponse({ error: message }, 400);
    }
  }

  if (action === 'remove') {
    const url = typeof body.url === 'string' ? body.url : undefined;
    if (!url) return jsonResponse({ error: 'missing_url' }, 400);
    try {
      const { domain, removed } = await removeMonitor(kv, url);
      return jsonResponse({ removed, domain });
    } catch (err) {
      const message = (err as Error).message || 'unknown';
      return jsonResponse({ error: message }, 400);
    }
  }

  if (action === 'run') {
    let emailer: Emailer | undefined;
    const resendKey = typeof env.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY : undefined;
    const adminEmail = typeof env.ADMIN_EMAIL === 'string' ? env.ADMIN_EMAIL : ADMIN_EMAIL_DEFAULT;
    if (resendKey) {
      emailer = createEmailer(resendKey, adminEmail);
    }

    const summary = await runMonitors(kv, (input) => scan(input), emailer);
    return jsonResponse(summary);
  }

  return jsonResponse({ error: 'invalid_action' }, 400);
};
