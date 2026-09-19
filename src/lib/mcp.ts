import type { McpServerConfig, McpToolDefinition } from '../types';

const PROTOCOL = '2025-03-26';
let requestId = 0;
type RpcResponse = { result?: unknown; error?: { message?: string; code?: number } };

function validateUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && !(import.meta.env.DEV && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))) {
    throw new Error('MCP endpoints must use HTTPS. HTTP is allowed only for localhost during development.');
  }
  if (url.username || url.password) throw new Error('Do not put credentials in an MCP URL. Use the bearer-token field.');
  return url.href;
}

async function rpc(server: Pick<McpServerConfig, 'url' | 'token'>, method: string, params?: Record<string, unknown>, signal?: AbortSignal, sessionId?: string): Promise<{ response: RpcResponse; sessionId?: string }> {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json',
    'MCP-Protocol-Version': PROTOCOL,
  };
  if (server.token?.trim()) headers.Authorization = `Bearer ${server.token.trim()}`;
  if (sessionId) headers['MCP-Session-Id'] = sessionId;
  const endpoint = new URL(validateUrl(server.url));
  let target = endpoint.href;
  if (endpoint.hostname === 'mcp.tavily.com') {
    const key = server.token?.trim() || endpoint.searchParams.get('tavilyApiKey');
    if (key) headers.Authorization = `Bearer ${key}`;
    if (!import.meta.env.DEV) {
      throw new Error('Tavily blocks direct browser connections. Use the local app (npm run dev). GitHub Pages needs a hosted backend relay before Tavily can connect.');
    }
    target = '/api/tavily/mcp';
  }
  const notification = method.startsWith('notifications/');
  let response: Response;
  try {
    response = await fetch(target, {
      method: 'POST', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000), headers,
      body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id: ++requestId }), method, params }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('MCP connection failed or timed out. The endpoint may be offline or may block browser access (CORS). Tavily connections require the local development server.');
  }
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} failed (HTTP ${response.status}). Check the endpoint and API key.`);
  if (notification) return { response: {}, sessionId };
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const events = text.split(/\r?\n\r?\n/).map(block => block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('')).filter(Boolean);
    const last = events.at(-1);
    if (!last) throw new Error(`${method} returned an empty event stream.`);
    return { response: JSON.parse(last) as RpcResponse, sessionId: response.headers.get('mcp-session-id') ?? sessionId ?? undefined };
  }
  return { response: JSON.parse(text) as RpcResponse, sessionId: response.headers.get('mcp-session-id') ?? sessionId ?? undefined };
}

function responseResult<T>(response: RpcResponse): T {
  if (response.error) throw new Error(response.error.message || `MCP error ${response.error.code ?? ''}`);
  return response.result as T;
}

export async function discoverMcpServer(server: McpServerConfig, signal?: AbortSignal): Promise<McpToolDefinition[]> {
  const initialized = await rpc(server, 'initialize', {
    protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 'CW.AI', version: '0.1.0' },
  }, signal);
  const initialize = responseResult<{ protocolVersion?: string }>(initialized.response);
  await rpc(server, 'notifications/initialized', undefined, signal, initialized.sessionId);
  const listed = await rpc(server, 'tools/list', undefined, signal, initialized.sessionId);
  const result = responseResult<{ tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown>; annotations?: { readOnlyHint?: boolean } }> }>(listed.response);
  if (!initialize.protocolVersion) throw new Error('The endpoint did not return an MCP initialize result.');
  return (result.tools ?? []).filter(t => typeof t.name === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(t.name)).map(t => ({
    name: t.name, description: t.description, inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
    // Tavily's published search/extract definitions omit readOnlyHint.
    // Recognize only these known retrieval tools on the official endpoint.
    readOnly: t.annotations?.readOnlyHint === true || (
      t.annotations?.readOnlyHint === undefined && new URL(server.url).hostname === 'mcp.tavily.com'
      && ['tavily_search', 'tavily-search', 'tavily_extract', 'tavily-extract'].includes(t.name)
    ),
  }));
}

export async function callMcpTool(server: McpServerConfig, tool: McpToolDefinition, args: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
  const initialized = await rpc(server, 'initialize', { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 'CW.AI', version: '0.1.0' } }, signal);
  responseResult(initialized.response);
  await rpc(server, 'notifications/initialized', undefined, signal, initialized.sessionId);
  const called = await rpc(server, 'tools/call', { name: tool.name, arguments: args }, signal, initialized.sessionId);
  const result = responseResult<{ content?: Array<{ type?: string; text?: string }>; isError?: boolean }>(called.response);
  const content = (result.content ?? []).map(item => item.type === 'text' ? item.text ?? '' : `[${item.type ?? 'content'}]`).join('\n').slice(0, 20000);
  return result.isError ? `Tool returned an error: ${content}` : content || '(Tool completed without text output.)';
}

export function safeMcpServer(raw: Pick<McpServerConfig, 'id' | 'name' | 'url' | 'enabled' | 'token'>): McpServerConfig {
  const url = new URL(validateUrl(raw.url));
  let token = raw.token;
  if (url.hostname === 'mcp.tavily.com') {
    token = token?.trim() || url.searchParams.get('tavilyApiKey') || undefined;
    url.searchParams.delete('tavilyApiKey');
  }
  return { ...raw, token, name: raw.name.trim().slice(0, 80) || 'MCP server', url: url.href, tools: [] };
}
