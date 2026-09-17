import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ChatWindow } from '../src/components/ChatWindow';
import { useMcpStore } from '../src/store/useMcpStore';

vi.mock('../src/components/Composer', () => ({ Composer: () => null }));
vi.mock('../src/components/EmptyState', () => ({ EmptyState: () => null }));
vi.mock('../src/lib/workspace', () => ({ storageOwner: () => 'guest', writeWorkspace: vi.fn() }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  useMcpStore.setState({ servers: [] });
});

it('mounts the chat with the real MCP store and updates the enabled count', () => {
  render(<ChatWindow sidebarCollapsed={false} onShowSidebar={() => {}} />);
  expect(screen.getByRole('button', { name: 'MCP (0)' })).toBeTruthy();
  act(() => useMcpStore.setState({ servers: [
    { id: 'example', name: 'Example', url: 'https://example.com/mcp', enabled: true, tools: [] },
  ] }));
  expect(screen.getByRole('button', { name: 'MCP (1)' })).toBeTruthy();
  act(() => useMcpStore.getState().toggleServer('example'));
  expect(screen.getByRole('button', { name: 'MCP (0)' })).toBeTruthy();
});

it('recovers from incorrectly shaped saved MCP settings', () => {
  localStorage.setItem('cwai:mcp-servers:guest', 'null');
  expect(() => useMcpStore.getState().loadServers()).not.toThrow();
  expect(useMcpStore.getState().servers).toEqual([]);
});
