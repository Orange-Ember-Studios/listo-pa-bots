import { describe, it, expect } from 'vitest';
import { parseMcpResponse, extractTools, parseSseData } from '../lib/mcp-parse.js';

describe('parseMcpResponse', () => {
  it('parses a plain JSON-RPC JSON response', () => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18' } });
    const parsed = parseMcpResponse(body, 'application/json');
    expect(parsed).not.toBeNull();
    expect(parsed?.jsonrpc).toBe('2.0');
    expect(parsed?.result?.protocolVersion).toBe('2025-06-18');
  });

  it('parses an SSE data line with JSON-RPC', () => {
    const body = 'data: {"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"scan_website"}]}}\n\n';
    const parsed = parseMcpResponse(body, 'text/event-stream');
    expect(parsed).not.toBeNull();
    expect(parsed?.result?.tools).toHaveLength(1);
  });

  it('returns null for non-JSON-RPC bodies', () => {
    expect(parseMcpResponse('{"foo":"bar"}', 'application/json')).toBeNull();
    expect(parseMcpResponse('hello world', 'text/plain')).toBeNull();
  });

  it('infers content type from body when header is missing', () => {
    const body = '{"jsonrpc":"2.0","id":1,"result":{}}';
    expect(parseMcpResponse(body)).not.toBeNull();
  });
});

describe('parseSseData', () => {
  it('extracts the first data field', () => {
    expect(parseSseData('data: hello\n\n')).toBe('hello');
    expect(parseSseData('event: msg\ndata: {"x":1}\n\n')).toBe('{"x":1}');
  });

  it('returns null when no data field exists', () => {
    expect(parseSseData('event: ping\n\n')).toBeNull();
  });
});

describe('extractTools', () => {
  it('returns tool names from a tools/list response', () => {
    const parsed = {
      jsonrpc: '2.0',
      id: 2,
      result: {
        tools: [{ name: 'scan_website' }, { name: 'hello_world' }],
      },
    };
    expect(extractTools(parsed)).toEqual(['scan_website', 'hello_world']);
  });

  it('returns empty array when no tools are present', () => {
    expect(extractTools({ jsonrpc: '2.0', result: {} })).toEqual([]);
    expect(extractTools({ jsonrpc: '2.0', result: { tools: 'no' } })).toEqual([]);
  });
});
