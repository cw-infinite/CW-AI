import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), createEmailPasswordSession: vi.fn(), get: vi.fn(), deleteSession: vi.fn(), readWorkspace: vi.fn() }));
vi.mock('../src/lib/appwrite', () => ({ account: mocks }));
vi.mock('../src/lib/workspace', () => ({ storageOwner: () => 'guest', writeWorkspace: vi.fn(), readWorkspace: mocks.readWorkspace }));
import { useChatStore } from '../src/store/useChatStore';
import { useAuthStore } from '../src/store/useAuthStore';
beforeEach(() => {
  vi.clearAllMocks();
  useChatStore.setState({ ready: true, activeStreams: {}, chats: [], memoryEnabled: true, forgottenMemoryIds: ['guest'] });
  useAuthStore.setState({ user: null, busy: false, error: '' });
  mocks.readWorkspace.mockResolvedValue({ chats: [], memoryEnabled: true, forgottenMemoryIds: ['private'] });
});
it('restores interactivity on invalid credentials without switching workspace', async () => {
  mocks.createEmailPasswordSession.mockRejectedValue(new Error('Invalid credentials'));
  await expect(useAuthStore.getState().login('test@example.com', 'invalid-password', false)).rejects.toThrow();
  expect(useChatStore.getState().ready).toBe(true);
  expect(useChatStore.getState().forgottenMemoryIds).toEqual(['guest']);
  expect(mocks.readWorkspace).not.toHaveBeenCalled();
});
it('uses the authenticated user ID to load private memory', async () => {
  mocks.createEmailPasswordSession.mockResolvedValue({});
  mocks.get.mockResolvedValue({ $id: 'account-A', email: 'test@example.com' });
  await useAuthStore.getState().login('test@example.com', 'example-password', false);
  expect(mocks.readWorkspace).toHaveBeenCalledWith('account-A');
  expect(useChatStore.getState().forgottenMemoryIds).toEqual(['private']);
  expect(useAuthStore.getState().busy).toBe(false);
});
it('does not sign out while a response is running', async () => {
  useChatStore.setState({ activeStreams: { chat: new AbortController() } });
  await expect(useAuthStore.getState().logout()).rejects.toThrow('Stop generation');
  expect(mocks.deleteSession).not.toHaveBeenCalled();
});

