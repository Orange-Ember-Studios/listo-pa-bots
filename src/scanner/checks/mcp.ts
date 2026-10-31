import type { CheckFn, CheckResult, CheckState } from '../types.js';
import { fetchText, withTimeout } from '../utils.js';

const MCP_ENDPOINTS = ['/mcp', '/mcp/', '/.well-known/mcp.json'];
const REQUEST_TIMEOUT_MS = 10_000;

interface EndpointProbe {
  url: string;
  method: string;
  status: number;
  contentType?: string;
  isMcp: boolean;
  error?: string;
  responsePreview?: string;
}

interface McpInitializeResponse {
  jsonrpc?: string;
  id?: number | string | null;
  result?: {
    protocolVersion?: string;
    capabilities?: Record<string, unknown>;
    serverInfo?: { name?: string; version?: string };
  };
  error?: { code?: number; message?: string };
}

function isJsonRpcResponse(body: unknown): body is McpInitializeResponse {
  return typeof body === 'object' && body !== null && (body as Record<string, unknown>).jsonrpc === '2.0';
}

async function probeEndpoint(url: string, method: 'GET' | 'POST'): Promise<EndpointProbe | null> {
  try {
    const init: RequestInit = {
      method,
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      redirect: 'follow',
    };

    if (method === 'POST') {
      init.body = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'ListoPaBots', version: '1.0' },
        },
      });
    }

    const { response, text } = await withTimeout(fetch(url, init), REQUEST_TIMEOUT_MS, `MCP probe ${method} ${url}`).then(async (res) => ({
      response: res,
      text: await res.text(),
    }));

    const contentType = response.headers.get('content-type') ?? undefined;
    const isJson = contentType?.includes('application/json') ?? text.trimStart().startsWith('{');
    const isSse = contentType?.includes('text/event-stream') ?? text.trimStart().startsWith('data:');

    let parsed: unknown = null;
    if (isJson) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // ignore
      }
    } else if (isSse) {
      const dataMatch = text.match(/data:\s*(.+)/);
      if (dataMatch) {
        try {
          parsed = JSON.parse(dataMatch[1].trim());
        } catch {
          // ignore
        }
      }
    }

    const isMcp = isJsonRpcResponse(parsed);

    return {
      url,
      method,
      status: response.status,
      contentType,
      isMcp,
      responsePreview: text.slice(0, 500),
    };
  } catch (err) {
    return {
      url,
      method,
      status: 0,
      isMcp: false,
      error: (err as Error).message,
    };
  }
}

async function mcpHandshake(endpointUrl: string): Promise<{ initialized: boolean; tools: string[]; probes: EndpointProbe[] }> {
  const probes: EndpointProbe[] = [];

  const initUrl = endpointUrl.replace(/\/$/, '');
  const initProbe = await probeEndpoint(initUrl, 'POST');
  probes.push(initProbe ?? { url: initUrl, method: 'POST', status: 0, isMcp: false });

  if (!initProbe || initProbe.status !== 200 || !initProbe.isMcp) {
    return { initialized: false, tools: [], probes };
  }

  // notifications/initialized
  try {
    await withTimeout(
      fetch(initUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
      }),
      REQUEST_TIMEOUT_MS,
      'MCP notifications/initialized'
    );
  } catch {
    // Ignorar errores de notificación; algunos servidores no requieren ack
  }

  // tools/list
  try {
    const toolsResponse = await withTimeout(
      fetch(initUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
      }),
      REQUEST_TIMEOUT_MS,
      'MCP tools/list'
    );
    const toolsText = await toolsResponse.text();
    probes.push({
      url: initUrl,
      method: 'POST',
      status: toolsResponse.status,
      contentType: toolsResponse.headers.get('content-type') ?? undefined,
      isMcp: true,
      responsePreview: toolsText.slice(0, 500),
    });

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(toolsText);
    } catch {
      const dataMatch = toolsText.match(/data:\s*(.+)/);
      if (dataMatch) {
        try {
          parsed = JSON.parse(dataMatch[1].trim());
        } catch {
          // ignore
        }
      }
    }

    if (isJsonRpcResponse(parsed) && parsed.result && typeof parsed.result === 'object') {
      const result = parsed.result as Record<string, unknown>;
      const tools = Array.isArray(result.tools)
        ? result.tools
            .map((t) => (typeof t === 'object' && t !== null ? (t as Record<string, unknown>).name : undefined))
            .filter((name): name is string => typeof name === 'string')
        : [];
      return { initialized: true, tools, probes };
    }
  } catch (err) {
    probes.push({
      url: initUrl,
      method: 'POST',
      status: 0,
      isMcp: false,
      error: (err as Error).message,
    });
  }

  return { initialized: true, tools: [], probes };
}

export const checkMcpOperability: CheckFn = async (ctx) => {
  const endpointProbes: EndpointProbe[] = [];
  let mcpEndpoint: string | null = null;

  for (const path of MCP_ENDPOINTS) {
    const url = new URL(path, ctx.origin).toString();
    const getProbe = await probeEndpoint(url, 'GET');
    if (getProbe) endpointProbes.push(getProbe);

    if (getProbe?.isMcp) {
      mcpEndpoint = url;
      break;
    }

    // Para paths que no son .json, probar POST directamente
    if (!path.endsWith('.json')) {
      const postProbe = await probeEndpoint(url, 'POST');
      if (postProbe) endpointProbes.push(postProbe);
      if (postProbe?.isMcp) {
        mcpEndpoint = url;
        break;
      }
    }
  }

  if (!mcpEndpoint) {
    return {
      id: 'mcp-operability',
      state: 'fallo',
      detail: 'Ningún endpoint candidato respondió como MCP con JSON-RPC válido',
      evidence: {
        endpointsTested: endpointProbes.map((p) => ({
          url: p.url,
          method: p.method,
          status: p.status,
          isMcp: p.isMcp,
        })),
      },
    };
  }

  const { initialized, tools, probes } = await mcpHandshake(mcpEndpoint);
  endpointProbes.push(...probes);

  let state: CheckState;
  let detail: string;
  if (initialized && tools.length > 0) {
    state = 'ok';
    detail = `Handshake MCP completo: ${tools.length} tool(s) disponible(s) en ${mcpEndpoint}`;
  } else if (initialized) {
    state = 'parcial';
    detail = `Endpoint MCP identificado en ${mcpEndpoint}, pero no se listaron tools`;
  } else {
    state = 'parcial';
    detail = `Endpoint MCP identificado en ${mcpEndpoint}, pero el handshake falló`;
  }

  return {
    id: 'mcp-operability',
    state,
    detail,
    evidence: {
      endpoint: mcpEndpoint,
      handshakeOk: initialized,
      toolsCount: tools.length,
      tools: tools.slice(0, 10),
      endpointsTested: endpointProbes.map((p) => ({
        url: p.url,
        method: p.method,
        status: p.status,
        isMcp: p.isMcp,
        error: p.error,
      })),
    },
  };
};
