import { useState } from 'react';
import { useMcpStore } from '../store/useMcpStore';

export function McpPanel({ onClose }: { onClose: () => void }) {
  const { servers, busyId, addServer, removeServer, toggleServer, refreshServer } = useMcpStore();
  const [name, setName] = useState(''); const [url, setUrl] = useState(''); const [token, setToken] = useState(''); const [error, setError] = useState('');
  return <div className="workspace-backdrop" onClick={onClose}><section role="dialog" aria-modal="true" aria-label="MCP servers" className="workspace-panel" onClick={e => e.stopPropagation()}>
    <div className="flex items-center justify-between"><h2>MCP servers</h2><button onClick={onClose} aria-label="Close MCP servers">✕</button></div>
    <p>Connect remote Streamable HTTP MCP servers. Enabled servers make their discovered tools available in chat.</p>
    <p className="text-xs">Tavily: use https://mcp.tavily.com/mcp/ and paste your API key in the bearer-token field. Pasted Tavily key URLs are also accepted. Tavily works through the local development server; GitHub Pages requires a hosted backend relay.</p>
    <form onSubmit={e => { e.preventDefault(); setError(''); void addServer({ name, url, token: token || undefined, enabled: true }).then(() => { setName(''); setUrl(''); setToken(''); }).catch(err => setError(err instanceof Error ? err.message : 'Could not connect.')); }}>
      <label>Name<input required value={name} onChange={e => setName(e.target.value)} placeholder="Example: My notes" /></label>
      <label>HTTPS MCP endpoint<input type="url" required value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/mcp" /></label>
      <label>Bearer token (optional)<input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Stored only in this browser" /></label>
      <button type="submit" disabled={!!busyId}>Connect and discover tools</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <h3>Connected servers</h3>
    {!servers.length && <p>No servers added yet.</p>}
    {servers.map(server => <div className="border-b border-[var(--border)] py-4" key={server.id}>
      <div className="flex items-center gap-2"><strong>{server.name}</strong><button aria-pressed={server.enabled} onClick={() => toggleServer(server.id)}>{server.enabled ? 'Enabled' : 'Disabled'}</button><button disabled={busyId === server.id} onClick={() => void refreshServer(server.id).catch(err => setError(err instanceof Error ? err.message : 'Connection failed.'))}>Refresh</button><button onClick={() => removeServer(server.id)}>Remove</button></div>
      <p className="break-all text-xs">{server.url}</p>
      {server.error && <p role="alert">{server.error}</p>}
      <p className="text-xs">{server.tools.length} discovered tools · {server.tools.filter(t => t.readOnly).length} marked read-only</p>
      <ul className="text-xs">{server.tools.map(tool => <li key={tool.name}><code>{tool.name}</code>{tool.readOnly ? ' · read-only' : ' · approval required'}{tool.description ? ` — ${tool.description}` : ''}</li>)}</ul>
    </div>)}
    <p className="mt-4 text-xs">Tokens are browser-local and are not included in workspace exports or Appwrite backups. OAuth-based MCP servers are not supported in this first version. The remote server must allow your app’s origin with CORS.</p>
  </section></div>;
}
