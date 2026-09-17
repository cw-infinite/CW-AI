import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProjectPanel } from '../src/components/ProjectPanel';
import { buildContext } from '../src/lib/context';
import type { Chat } from '../src/types';
afterEach(cleanup);
const chat: Chat = { id: 'c', title: 'Build', createdAt: 1, updatedAt: 1, messages: [
  { id: 'u', role: 'user', content: 'Build a project', createdAt: 1 },
  { id: 'a', role: 'assistant', content: '```js file=main.js\nconsole.log("hello");\n```\n```js file=incomplete.js\npartial', createdAt: 2, error: 'The response reached its output limit. Ask the model to continue with the remaining complete files.' },
  { id: 'u2', role: 'user', content: 'Continue the remaining files', createdAt: 3 },
] };
it('makes complete files from previously failed responses downloadable', () => {
  render(<ProjectPanel messages={chat.messages} />);
  expect(screen.getByRole('button', { name: 'Download ZIP' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'main.js' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'incomplete.js' })).toBeNull();
});
it('keeps the truncated answer in context for continuation', () => {
  const result = buildContext(chat, 'new', [chat], true);
  expect(result.messages.find(m => m.id === 'a')?.content).toContain('incomplete.js');
});
it('offers ZIP downloads for ordinary unnamed code answers without merging them', () => {
  render(<ProjectPanel messages={[1, 2].map(n => ({ id: String(n), role: 'assistant', content: `\x60\x60\x60html\n<h1>Example ${n}</h1>\n\x60\x60\x60`, createdAt: n }))} />);
  expect(screen.getByRole('button', { name: 'Download ZIP' })).toBeTruthy();
  expect(screen.getAllByRole('option')).toHaveLength(2);
  expect(screen.getByRole('status').textContent).toContain('no filename');
});
