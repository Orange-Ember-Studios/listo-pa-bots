import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { z } from 'zod';
import { scan } from '../scanner/index.js';
import { scoreScan } from '../scoring/index.js';
import { makeReportId } from '../lib/reports.js';
import {
  checkScanRateLimit,
  recordScanAttempt,
  incrementScanStats,
  type RateLimitKv,
} from '../lib/rate-limit.js';
import { parseMcpResponse, extractTools, type McpInitializeResponse } from '../lib/mcp-parse.js';

function getReportsKv(): RateLimitKv | null {
  const kv = env.REPORTS as { get?: (key: string) => Promise<string | null>; put?: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void> } | undefined;
  if (!kv?.get || !kv?.put) return null;
  return kv as RateLimitKv;
}

function createServer() {
  const server = new McpServer({
    name: 'ListoPaBots',
    version: '1.0.0',
  });

  server.registerTool(
    'scan_website',
    {
      description: 'Escanea un sitio web y devuelve su puntaje de agentic-readiness (Listo Pa Bots).',
      inputSchema: z.object({
        url: z.string().url().describe('URL completa del sitio a escanar, por ejemplo https://tunegocio.com'),
      }),
    },
    async ({ url }, ctx) => {
      const originalRequest = ctx.http?.req as Request | undefined;
      const kv = getReportsKv();

      if (originalRequest && kv) {
        const limit = await checkScanRateLimit(originalRequest, kv);
        if (!limit.allowed) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: 'rate_limited',
                    retry_after_seconds: limit.retryAfter,
                    message: 'Demasiados escaneos seguidos — espera unos minutos e intenta de nuevo.',
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      }

      const target = new URL(url);
      const result = await scan({ url: target.toString() });
      const scored = scoreScan(result);

      // Origen del request original para construir informe_url sin persistir en KV.
      const origin =
        typeof ctx.http?.req?.url === 'string'
          ? new URL(ctx.http.req.url).origin
          : `https://${target.hostname}`;

      const id = makeReportId(target, new Date(result.date));
      const informeUrl = `${origin}/informe/${id}`;

      if (originalRequest && kv) {
        await recordScanAttempt(kv, originalRequest);
        await incrementScanStats(kv);
        await kv.put(`informe/${id}`, JSON.stringify(result));
      }

      const payload = {
        url: result.url,
        score: scored.score,
        label: scored.label,
        breakdown: scored.breakdown.map((item) => ({
          id: item.id,
          state: item.state,
          earned: item.earned,
          max: item.max,
        })),
        informe_url: informeUrl,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );

  return server;
}

const handler = createMcpHandler(createServer, {
  route: '/mcp',
  allowedHostnames: ['localhost', 'listopabots.orangeember.com', 'listo-pa-bots.orange-ember-studios.workers.dev'],
  allowedOriginHostnames: '*',
});

export const ALL: APIRoute = ({ request, locals }) => {
  const ctx = (locals as { runtime?: { cfContext: ExecutionContext } }).runtime?.cfContext;
  return handler(request, env, ctx);
};
