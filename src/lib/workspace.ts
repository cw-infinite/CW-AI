import { get, set } from 'idb-keyval';
import type { Chat, ChatMessage } from '../types';
import { loadJSON, STORAGE_KEYS } from './storage';

export interface Workspace { chats: Chat[]; memoryEnabled: boolean; forgottenMemoryIds: string[] }
let owner = 'guest';
let queue = Promise.resolve();
export function storageOwner() { return owner; }
export async function readWorkspace(user?: string): Promise<Workspace> {
  await queue;
  owner = user ? `user:${user}` : 'guest';
  const saved = await get<Workspace>(`workspace:${owner}`);
  const workspace = saved ?? { chats: !user ? loadJSON<Chat[]>(STORAGE_KEYS.chats, []) : [] };
  return validateWorkspace(workspace);
}
export function writeWorkspace(workspace: Workspace) {
  const key = `workspace:${owner}`;
  queue = queue.catch(() => {}).then(() => set(key, workspace)).catch((error) => {
    window.dispatchEvent(new CustomEvent('storage-error', { detail: `Unable to save locally: ${error.message}. Export your workspace before closing.` }));
  });
}
export function validateWorkspace(value: unknown): Workspace {
  const w = value as Workspace;
  const validMessage = (m: ChatMessage) => m && typeof m.id === 'string' &&
    ['user', 'assistant', 'system'].includes(m.role) && typeof m.content === 'string' && Number.isFinite(m.createdAt) &&
    (!m.images || (Array.isArray(m.images) && m.images.every(i => i && typeof i.id === 'string' && typeof i.name === 'string' &&
      typeof i.dataUrl === 'string' && /^data:image\/(png|jpeg|gif|webp);base64,/.test(i.dataUrl))));
  if (!w || !Array.isArray(w.chats) || (w.memoryEnabled !== undefined && typeof w.memoryEnabled !== 'boolean') ||
    (w.forgottenMemoryIds !== undefined && (!Array.isArray(w.forgottenMemoryIds) || !w.forgottenMemoryIds.every(id => typeof id === 'string' && id.length <= 600))) ||
    !w.chats.every(c => c && typeof c.id === 'string' && typeof c.title === 'string' && Number.isFinite(c.createdAt) && Number.isFinite(c.updatedAt) &&
      Array.isArray(c.messages) && c.messages.every(validMessage))) {
    throw new Error('Invalid workspace file.');
  }
  if (new Set(w.chats.map(c => c.id)).size !== w.chats.length) throw new Error('Duplicate chat IDs.');
  return { memoryEnabled: w.memoryEnabled ?? true, forgottenMemoryIds: w.forgottenMemoryIds ?? [], chats: w.chats.map(c => ({
    id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt,
    messages: c.messages.map(m => ({ ...m, streaming: false, sources: Array.isArray(m.sources) ? m.sources.filter(s =>
      s && typeof s.title === 'string' && typeof s.excerpt === 'string' && typeof s.url === 'string' && /^https?:\/\//.test(s.url)) : undefined })),
  })) };
}
