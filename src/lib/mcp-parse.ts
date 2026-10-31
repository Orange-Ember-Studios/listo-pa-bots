export interface McpInitializeResponse {
  jsonrpc?: string;
  id?: number | string | null;
  result?: Record<string, unknown>;
  error?: { code?: number; message?: string };
}

export function isJsonRpcResponse(body: unknown): body is McpInitializeResponse {
  return typeof body === 'object' && body !== null && (body as Record<string, unknown>).jsonrpc === '2.0';
}

export function parseSseData(text: string): string | null {
  const match = text.match(/data:\s*(.+)/);
  return match ? match[1].trim() : null;
}

export function parseMcpResponse(text: string, contentType?: string): McpInitializeResponse | null {
  const isJson = contentType?.includes('application/json') ?? text.trimStart().startsWith('{');
  const isSse = contentType?.includes('text/event-stream') ?? text.trimStart().startsWith('data:');

  if (isJson) {
    try {
      const parsed = JSON.parse(text);
      return isJsonRpcResponse(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  if (isSse) {
    const data = parseSseData(text);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      return isJsonRpcResponse(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

export function extractTools(parsed: McpInitializeResponse): string[] {
  if (!parsed.result || typeof parsed.result !== 'object') return [];
  const result = parsed.result as Record<string, unknown>;
  if (!Array.isArray(result.tools)) return [];
  return result.tools
    .map((tool) => (typeof tool === 'object' && tool !== null ? (tool as Record<string, unknown>).name : undefined))
    .filter((name): name is string => typeof name === 'string');
}
