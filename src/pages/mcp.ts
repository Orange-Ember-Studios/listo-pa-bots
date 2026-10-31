import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { z } from 'zod';
import { scan } from '../scanner/index.js';
import { scoreScan } from '../scoring/index.js';

function makeId(url: URL, date: Date): string {
  const host = url.hostname.replace(/^www\./, '');
  const iso = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${host}-${iso}`;
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
      const target = new URL(url);
      const result = await scan({ url: target.toString() });
      const scored = scoreScan(result);

      // Origen del request original para construir informe_url sin persistir en KV.
      const origin =
        typeof ctx.http?.req?.url === 'string'
          ? new URL(ctx.http.req.url).origin
          : `https://${target.hostname}`;

      const id = makeId(target, new Date(result.date));
      const informeUrl = `${origin}/informe/${id}`;

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
