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
});
