import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { readWorkspace, writeWorkspace } from '../src/lib/workspace';
it('keeps guest, account A and account B workspaces separate', async () => {
  await readWorkspace();
  writeWorkspace({ chats: [], memoryEnabled: true, forgottenMemoryIds: ['Guest exclusion'] });
  expect((await readWorkspace('account-A')).forgottenMemoryIds).toEqual([]);
  writeWorkspace({ chats: [], memoryEnabled: false, forgottenMemoryIds: ['Private exclusion'] });
  expect((await readWorkspace('account-B')).forgottenMemoryIds).toEqual([]);
  expect((await readWorkspace()).forgottenMemoryIds).toEqual(['Guest exclusion']);
  expect((await readWorkspace('guest')).forgottenMemoryIds).toEqual([]);
  expect((await readWorkspace('account-A')).forgottenMemoryIds).toEqual(['Private exclusion']);
});

