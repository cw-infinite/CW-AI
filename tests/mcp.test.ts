import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callMcpTool, discoverMcpServer, safeMcpServer } from '../src/lib/mcp';
const server = { id: 's', name: 'Test', url: 'https://mcp.example.com/mcp', enabled: true, tools: [] };
function json(body: unknown, headers?: Record<string, string>) { return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', ...headers } }); }
beforeEach(() => vi.restoreAllMocks());
describe('remote MCP transport', () => {
  it('initializes, carries session state, and discovers tools', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ result: { protocolVersion: '2025-03-26' } }, { 'MCP-Session-Id': 'session-1' }))
      .mockResolvedValueOnce(new Response('', { status: 202 }))
      .mockResolvedValueOnce(json({ result: { tools: [{ name: 'search', description: 'Search notes', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } }] } }));
    const tools = await discoverMcpServer(server);
    expect(tools).toEqual([{ name: 'search', description: 'Search notes', inputSchema: { type: 'object' }, readOnly: true }]);
    expect(fetchMock.mock.calls[2][1]?.headers).toMatchObject({ 'MCP-Session-Id': 'session-1' });
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).not.toHaveProperty('id');
  });
  it('starts a fresh session and returns safe text tool output', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ result: { protocolVersion: '2025-03-26' } }, { 'MCP-Session-Id': 'session-2' }))
      .mockResolvedValueOnce(new Response('', { status: 202 }))
      .mockResolvedValueOnce(json({ result: { content: [{ type: 'text', text: 'Found 3 documents' }] } }));
    const output = await callMcpTool({ ...server, tools: [] }, { name: 'search', readOnly: true }, { q: 'test' });
    expect(output).toBe('Found 3 documents');
    expect(fetchMock.mock.calls[2][1]?.headers).toMatchObject({ 'MCP-Session-Id': 'session-2' });
  });
  it('requires https outside local development and rejects credential URLs', () => {
    expect(() => safeMcpServer({ id: 's', name: 'Bad', url: 'http://example.com/mcp', enabled: true })).toThrow('HTTPS');
    expect(() => safeMcpServer({ id: 's', name: 'Bad', url: 'https://secret@example.com/mcp', enabled: true })).toThrow('credentials');
  });
  it('moves a pasted Tavily key to the token field and uses the local relay', async () => {
    const normalized = safeMcpServer({ ...server, url: 'https://mcp.tavily.com/mcp/?tavilyApiKey=test-key' });
    expect(normalized.url).toBe('https://mcp.tavily.com/mcp/');
    expect(normalized.token).toBe('test-key');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ result: { protocolVersion: '2025-03-26' } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(json({ result: { tools: [{ name: 'tavily_search' }, { name: 'tavily_feedback' }] } }));
    const discovered = await discoverMcpServer(normalized);
    expect(discovered.map(tool => tool.readOnly)).toEqual([true, false]);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/tavily/mcp');
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer test-key' });
  });
  it('reports connection failures without exposing endpoint credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(discoverMcpServer(server)).rejects.toThrow('CORS');
  });
});
