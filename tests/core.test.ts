import { describe, expect, it } from 'vitest';
import { buildContext } from '../src/lib/context';
import { extractFiles } from '../src/lib/projects';
import { validateWorkspace } from '../src/lib/workspace';
import { publicIPv4, readPage } from '../server/web.mjs';
import type { Chat } from '../src/types';

describe('bounded model context', () => {
  it('automatically retrieves matching older messages without sending the full history', () => {
    const chat: Chat = { id: 'c', title: 'Test', createdAt: 0, updatedAt: 0, messages:
      Array.from({ length: 100 }, (_, i) => ({ id: String(i), role: i % 2 ? 'assistant' : 'user', content: i === 0 ? 'I enjoy learning about zebras' : i === 98 ? 'Tell me about zebras habitats' : 'x'.repeat(10000), createdAt: i })) };
    const result = buildContext(chat, '99', [chat], true);
    expect(result.messages[0].content).toContain('I enjoy learning about zebras');
    expect(result.messages.at(-1)?.id).toBe('98');
    expect(result.messages.slice(1).reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(24000);
    expect(chat.messages).toHaveLength(100);
  });
});
describe('generated files', () => {
  it('recognizes filenames in headings and fence labels', () => {
    const text = '### **src/App.tsx**\n\n```tsx\nexport default App;\n```\n\n```json title="package.json"\n{}\n```\n\n```src/main.ts\nstart();\n```';
    expect(extractFiles(text).map(f => f.path)).toEqual(['src/App.tsx', 'package.json', 'src/main.ts']);
  });
  it('exports unnamed blocks as distinct snippets and preserves nested shorter fences', () => {
    const text = '```html\n<h1>Hello</h1>\n```\n\n````md file=README.md\n```sh\nnpm start\n```\n````';
    const files = extractFiles(text, 'snippets/answer-2');
    expect(files[0]).toMatchObject({ path: 'snippets/answer-2/code-1.html', inferred: true });
    expect(files[1]).toEqual({ path: 'README.md', content: '```sh\nnpm start\n```\n' });
  });
  it('extracts complete files, uses the latest revision, rejects traversal and Windows paths', () => {
    const block = (p: string, content = 'ok') => '```ts file=' + p + '\n' + content + '\n```\n';
    const files = extractFiles(block('src/a.ts', 'old') + block('../secret') + block('C:/secret') + block('dir/CON.txt') + block('src/a.ts', 'new') + '```js file=incomplete.js\npartial');
    expect(files).toEqual([{ path: 'src/a.ts', content: 'new\n' }]);
  });
});
describe('import boundary', () => {
  it('rejects malformed records and clears interrupted streaming state', () => {
    expect(() => validateWorkspace({ notes: '', chats: [null] })).toThrow();
    expect(() => validateWorkspace({ notes: '', chats: [{ messages: [] }] })).toThrow();
    const result = validateWorkspace({ notes: 'note', chats: [{ id: 'c', title: 'Test', createdAt: 1, updatedAt: 1, messages: [{ id: 'm', role: 'assistant', content: 'hello', createdAt: 1, streaming: true }] }] });
    expect(result.chats[0].messages[0].streaming).toBe(false);
  });
});
describe('public-page reader boundary', () => {
  it('blocks private, reserved, IPv6 and metadata addresses', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.1.2', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::ffff:127.0.0.1']) expect(publicIPv4(ip)).toBe(false);
    expect(publicIPv4('8.8.8.8')).toBe(true);
  });
  it('rejects unsafe URL schemes and ports before fetching', async () => {
    for (const url of ['file:///etc/passwd', 'http://example.com', 'https://example.com:8443', 'https://user:pass@example.com']) await expect(readPage(url)).rejects.toThrow();
  });
});

