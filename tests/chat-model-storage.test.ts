import { expect, it } from 'vitest';
import { validateWorkspace } from '../src/lib/workspace';

it('preserves chat model overrides on reload/import and accepts older chats without a model', () => {
  const chat = { id: 'one', title: 'Example', messages: [], createdAt: 1, updatedAt: 1 };
  expect(validateWorkspace({ chats: [{ ...chat, model: 'example/model:free' }] }).chats[0].model).toBe('example/model:free');
  expect(validateWorkspace({ chats: [chat] }).chats[0].model).toBeUndefined();
  expect(() => validateWorkspace({ chats: [{ ...chat, model: {} }] })).toThrow('Invalid workspace');
});
