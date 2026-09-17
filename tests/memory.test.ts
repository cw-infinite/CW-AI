import { describe, expect, it } from 'vitest';
import { collectMemories } from '../src/lib/memory';
import { buildContext } from '../src/lib/context';
import { validateWorkspace } from '../src/lib/workspace';
import type { Chat } from '../src/types';
const makeChat = (id: string, texts: string[]): Chat => ({ id, title: id, createdAt: 1, updatedAt: 1,
  messages: texts.map((content, i) => ({ id: `${id}-${i}`, role: 'user', content, createdAt: i + 1 })) });
describe('automatic memory', () => {
  it('recalls a relevant previous chat and skips an unrelated topic', () => {
    const past = makeChat('learning', ['I am learning React and prefer simple examples.', 'Explain the history of medieval castles.']);
    const current = makeChat('today', ['How do React hooks work?']);
    const result = buildContext(current, 'new-answer', [past, current], false);
    expect(result.memories.map(m => m.text)).toContain('I am learning React and prefer simple examples.');
    expect(result.messages[0].content).not.toContain('medieval castles');
  });
  it('does not store assistant guesses, code blocks, or obvious secrets as memory', () => {
    const chat = makeChat('test', ['My password is super-secret-password', '```js\nI am a secret coder in a code block\n```']);
    chat.messages.push({ id: 'assistant', role: 'assistant', content: 'The user prefers Java.', createdAt: 4 });
    expect(collectMemories([chat])).toEqual([]);
  });
  it('forgets duplicate details across chats and disabled memory adds no history', () => {
    const past = makeChat('past', ['I prefer TypeScript for web projects.']);
    const duplicate = makeChat('duplicate', ['I prefer TypeScript for web projects.']);
    const current = makeChat('now', ['What should I use for web projects?']);
    const id = collectMemories([past])[0].id;
    expect(collectMemories([past, duplicate], [id])).toEqual([]);
    expect(buildContext(current, 'new', [past, current], false, { memoryEnabled: false, forgottenMemoryIds: [] }).memories).toEqual([]);
    expect(buildContext(current, 'new', [past, current], false, { memoryEnabled: true, forgottenMemoryIds: [id] }).memories).toEqual([]);
  });
  it('keeps recall bounded and does not use later messages on retry', () => {
    const past = makeChat('past', Array.from({ length: 30 }, (_, i) => `I prefer React example number ${i} for learning.`));
    const current = makeChat('now', ['Explain React hooks.', 'This later React statement should not leak into retry.']);
    const result = buildContext(current, 'now-1', [past, current], false);
    expect(result.memories.length).toBeLessThanOrEqual(6);
    expect(result.messages[0].content).not.toContain('should not leak');
  });
  it('migrates old memo backups without including the manual notes', () => {
    const chat = { ...makeChat('old', ['I enjoy learning React with examples.']), memory: 'legacy conversation memo' };
    const workspace = validateWorkspace({ chats: [chat], notes: 'legacy manual memo' });
    expect(workspace.memoryEnabled).toBe(true);
    expect(workspace.forgottenMemoryIds).toEqual([]);
    expect(JSON.stringify(workspace)).not.toContain('legacy');
    expect(collectMemories(workspace.chats)).toHaveLength(1);
  });
  it('removes recalled knowledge when its source chat is removed', () => {
    const old = makeChat('old', ['We decided to use Appwrite for authentication.']);
    const current = makeChat('new', ['How should we implement Appwrite authentication?']);
    expect(buildContext(current, 'answer', [old, current], false).memories).toHaveLength(1);
    expect(buildContext(current, 'answer', [current], false).memories).toHaveLength(0);
  });
  it('round-trips exclusions and the disabled setting in a backup', () => {
    const workspace = validateWorkspace(JSON.parse(JSON.stringify({ chats: [], memoryEnabled: false, forgottenMemoryIds: ['forgotten detail'] })));
    expect(workspace).toEqual({ chats: [], memoryEnabled: false, forgottenMemoryIds: ['forgotten detail'] });
  });
});
