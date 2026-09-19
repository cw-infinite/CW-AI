import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ stream: vi.fn(), write: vi.fn(), research: vi.fn() }));
vi.mock('../src/lib/openrouter', () => ({ streamChatCompletion: mocks.stream }));
vi.mock('../src/lib/workspace', () => ({ storageOwner: () => 'guest', writeWorkspace: mocks.write, readWorkspace: async () => ({ chats: [], memoryEnabled: true, forgottenMemoryIds: [] }) }));
vi.mock('../src/lib/web', () => ({ research: mocks.research }));
import { useChatStore } from '../src/store/useChatStore';
import { useSettingsStore } from '../src/store/useSettingsStore';

beforeEach(() => {
  vi.clearAllMocks();
  useChatStore.setState({ ready: true, chats: [], memoryEnabled: true, forgottenMemoryIds: [], activeChatId: null, activeStreams: {}, webEnabled: false, projectMode: false });
});
describe('chat lifecycle', () => {
  it('uses each chat override for sending and retrying, and follows the default after clearing it', async () => {
    mocks.stream.mockResolvedValue(undefined);
    useSettingsStore.getState().setModel('default/model:free');
    useChatStore.getState().newChat();
    const id = useChatStore.getState().activeChatId!;
    useChatStore.getState().setChatModel(id, 'override/model:free');
    await useChatStore.getState().sendMessage('hello');
    expect(mocks.stream.mock.lastCall?.[0].model).toBe('override/model:free');
    await useChatStore.getState().retryLastMessage(id);
    expect(mocks.stream.mock.lastCall?.[0].model).toBe('override/model:free');
    useChatStore.getState().newChat();
    await useChatStore.getState().sendMessage('another chat');
    expect(mocks.stream.mock.lastCall?.[0].model).toBe('default/model:free');
    useChatStore.getState().selectChat(id);
    useChatStore.getState().setChatModel(id, '');
    useSettingsStore.getState().setModel('new/default:free');
    await useChatStore.getState().sendMessage('follow default');
    expect(mocks.stream.mock.lastCall?.[0].model).toBe('new/default:free');
    expect(mocks.write.mock.lastCall?.[0].chats.find(c => c.id === id).model).toBeUndefined();
  });
  it('batches streamed tokens and saves only at turn boundaries', async () => {
    mocks.stream.mockImplementation(async ({ onDelta }) => { for (let i = 0; i < 100; i++) onDelta('a'); });
    await useChatStore.getState().sendMessage('hello');
    const state = useChatStore.getState();
    expect(state.chats[0].messages[1].content).toBe('a'.repeat(100));
    expect(state.chats[0].messages[1].streaming).toBe(false);
    expect(state.activeStreams).toEqual({});
    expect(mocks.write).toHaveBeenCalledTimes(2);
  });
  it('does not start concurrent turns in the same chat and stops cleanly', async () => {
    mocks.stream.mockImplementation(({ signal, onDelta }) => new Promise<void>(resolve => { onDelta('partial'); signal.addEventListener('abort', () => resolve()); }));
    const pending = useChatStore.getState().sendMessage('first');
    await useChatStore.getState().sendMessage('second');
    const id = useChatStore.getState().activeChatId!;
    expect(useChatStore.getState().chats[0].messages).toHaveLength(2);
    await expect(useChatStore.getState().loadWorkspace('another-user')).rejects.toThrow('Stop generation');
    useChatStore.getState().stopGenerating(id);
    await pending;
    expect(useChatStore.getState().chats[0].messages[1]).toMatchObject({ content: 'partial', streaming: false });
  });
  it('reports search failures without pretending the answer is web-grounded', async () => {
    useChatStore.setState({ webEnabled: true });
    mocks.research.mockRejectedValue(new Error('No results'));
    await useChatStore.getState().sendMessage('search for something');
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(useChatStore.getState().chats[0].messages[1].error).toBe('No results');
  });
  it('persists an error and clears it when the last answer is retried', async () => {
    mocks.stream.mockRejectedValueOnce(new Error('Rate limited')).mockImplementationOnce(async ({ onDelta }) => onDelta('Success'));
    await useChatStore.getState().sendMessage('hello');
    const id = useChatStore.getState().activeChatId!;
    expect(useChatStore.getState().chats[0].messages[1].error).toBe('Rate limited');
    await useChatStore.getState().retryLastMessage(id);
    expect(useChatStore.getState().chats[0].messages[1]).toMatchObject({ content: 'Success', error: undefined, streaming: false });
  });
});

