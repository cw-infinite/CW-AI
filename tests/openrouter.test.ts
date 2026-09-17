import { expect, it, vi } from 'vitest';
import { streamChatCompletion } from '../src/lib/openrouter';
import { resolveOutputLimit } from '../src/lib/outputLimits';
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@openrouter/sdk', () => ({ OpenRouter: class { chat = { send }; } }));
it('refuses paid models before any network call', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  await expect(streamChatCompletion({ apiKey: 'test', model: 'openrouter/auto', messages: [], onDelta: () => {} })).rejects.toThrow('Free-only');
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});
it('bounds requested output by catalog limits and supports provider defaults', () => {
  expect(resolveOutputLimit(32768, 8192)).toBe(8192);
  expect(resolveOutputLimit(16384, null)).toBe(16384);
  expect(resolveOutputLimit(0, 8192)).toBeUndefined();
});
it('preserves truncated output and reports the limit without throwing it away', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'test/model:free', name: 'Test', pricing: { prompt: '0', completion: '0' }, top_provider: { max_completion_tokens: 8192 } }] })));
  send.mockImplementation(async () => (async function* () {
    yield { choices: [{ delta: { content: 'complete file plus partial output' } }] };
    yield { choices: [{ finishReason: 'length' }] };
  })());
  const onOutputLimit = vi.fn();
  const result = await streamChatCompletion({ apiKey: 'test', model: 'test/model:free', maxOutputTokens: 32768, messages: [], onDelta: () => {}, onOutputLimit });
  expect(result).toContain('partial output');
  expect(onOutputLimit).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][0].chatRequest.maxTokens).toBe(8192);
  fetchSpy.mockRestore();
});
