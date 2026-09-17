import { memo, useLayoutEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';

const Bubble = memo(MessageBubble);
const PAGE_SIZE = 30;
export function MessageList({ messages, onRetry }: { messages: ChatMessage[]; onRetry: () => void }) {
  const [page, setPage] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<{ id: string } | null>(null);
  const handledTarget = useRef<typeof target>(null);
  const [pinned, setPinned] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const lastPage = Math.max(0, Math.ceil(messages.length / PAGE_SIZE) - 1);
  const current = page === null ? lastPage : Math.min(page, lastPage);
  const start = current * PAGE_SIZE;
  const visible = messages.slice(start, start + PAGE_SIZE);
  const lastContent = messages.at(-1)?.content;
  const topics = messages.map((m, index) => ({ m, index })).filter(({ m }) => m.role === 'user' && m.content.toLowerCase().includes(query.toLowerCase()));
  useLayoutEffect(() => {
    if (target && target !== handledTarget.current) {
      document.getElementById(`message-${target.id}`)?.scrollIntoView({ block: 'start' });
      handledTarget.current = target;
    } else if (page === null && pinned && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [target, current, messages.length, lastContent, page, pinned]);
  function move(next: number | null) {
    setPage(next); setPinned(next === null);
    if (ref.current) ref.current.scrollTop = 0;
  }
  return <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="topic-toolbar">
      <input aria-label="Search conversation topics" placeholder="Find a topic…" value={query} onChange={e => setQuery(e.target.value)} />
      <select aria-label="Jump to topic" value="" onChange={e => { const index = Number(e.target.value); setPage(Math.floor(index / PAGE_SIZE)); setPinned(false); setTarget({ id: messages[index].id }); }}>
        <option value="">Jump to topic ({topics.length})</option>
        {topics.map(({ m, index }) => <option key={m.id} value={index}>{index + 1}. {m.content.slice(0, 85) || 'Image message'}</option>)}
      </select>
      <button aria-label="Previous page" disabled={current === 0} onClick={() => move(current - 1)}>←</button>
      <span>{current + 1}/{lastPage + 1}</span>
      <button aria-label="Next page" disabled={current === lastPage} onClick={() => move(current + 1 === lastPage ? null : current + 1)}>→</button>
    </div>
    <div ref={ref} onScroll={() => { const el = ref.current; if (el) setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 80); }} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-1 py-6">
        {visible.map(m => <div key={m.id} id={`message-${m.id}`}><Bubble message={m} onRetry={m.id === messages.at(-1)?.id && m.error ? onRetry : undefined} /></div>)}
      </div>
    </div>
    {(page !== null || !pinned) && <button className="latest-button" onClick={() => { move(null); if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }}>↓ Latest message</button>}
  </div>;
}
