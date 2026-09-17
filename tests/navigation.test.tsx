import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MessageList } from '../src/components/MessageList';
import type { ChatMessage } from '../src/types';
vi.mock('../src/components/MessageBubble', () => ({ MessageBubble: ({ message }: { message: ChatMessage }) => <p data-testid="message">{message.content}</p> }));
afterEach(cleanup);
it('renders at most 30 messages and jumps to an unmounted older topic', () => {
  Element.prototype.scrollIntoView = vi.fn();
  const messages: ChatMessage[] = Array.from({ length: 1000 }, (_, i) => ({ id: String(i), role: i % 2 ? 'assistant' : 'user', content: `Topic ${i}`, createdAt: i }));
  render(<MessageList messages={messages} onRetry={() => {}} />);
  expect(screen.getAllByTestId('message').length).toBeLessThanOrEqual(30);
  fireEvent.change(screen.getByLabelText('Jump to topic'), { target: { value: '20' } });
  expect(screen.getByText('Topic 20')).toBeTruthy();
  expect(screen.queryByText('Topic 999')).toBeNull();
  expect(screen.getAllByTestId('message')).toHaveLength(30);
  fireEvent.click(screen.getByText('↓ Latest message'));
  expect(screen.getByText('Topic 999')).toBeTruthy();
});
