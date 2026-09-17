import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { McpServerConfig } from '../types';
import { loadJSON, saveJSON } from '../lib/storage';
import { discoverMcpServer, safeMcpServer } from '../lib/mcp';
import { storageOwner } from '../lib/workspace';

const KEY = 'cwai:mcp-servers:';
interface McpState {
  servers: McpServerConfig[]; busyId: string | null;
  loadServers: () => void;
  addServer: (input: Omit<McpServerConfig, 'id' | 'tools' | 'error' | 'connectedAt'>) => Promise<void>;
  removeServer: (id: string) => void; toggleServer: (id: string) => void; refreshServer: (id: string) => Promise<void>;
}
function valid(config: unknown): config is McpServerConfig { return !!config && typeof config === 'object' && typeof (config as McpServerConfig).id === 'string' && typeof (config as McpServerConfig).name === 'string' && typeof (config as McpServerConfig).url === 'string' && Array.isArray((config as McpServerConfig).tools); }
function load() { return loadJSON<unknown[]>(`${KEY}${storageOwner()}`, []).filter(valid); }
function persist(servers: McpServerConfig[]) { saveJSON(`${KEY}${storageOwner()}`, servers); }
export const useMcpStore = create<McpState>((set, get) => ({
  servers: load(), busyId: null,
  loadServers: () => set({ servers: load(), busyId: null }),
  addServer: async input => {
    const server = safeMcpServer({ ...input, id: nanoid() });
    set({ busyId: server.id });
    try {
      const tools = await discoverMcpServer(server);
      const next = [...get().servers, { ...server, tools, connectedAt: Date.now() }]; set({ servers: next }); persist(next);
    } finally { set({ busyId: null }); }
  },
  removeServer: id => { const servers = get().servers.filter(s => s.id !== id); set({ servers }); persist(servers); },
  toggleServer: id => { const servers = get().servers.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s); set({ servers }); persist(servers); },
  refreshServer: async id => {
    const server = get().servers.find(s => s.id === id); if (!server) return;
    set({ busyId: id });
    try { const tools = await discoverMcpServer(server); const servers = get().servers.map(s => s.id === id ? { ...s, tools, error: undefined, connectedAt: Date.now() } : s); set({ servers }); persist(servers); }
    catch (error) { const servers = get().servers.map(s => s.id === id ? { ...s, error: error instanceof Error ? error.message : 'Connection failed.' } : s); set({ servers }); persist(servers); throw error; }
    finally { set({ busyId: null }); }
  },
}));
