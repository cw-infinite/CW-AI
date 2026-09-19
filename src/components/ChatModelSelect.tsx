import { useEffect, useState } from 'react';
import { getFreeModels, type ModelOption } from '../lib/openrouter';
import { useChatStore } from '../store/useChatStore';
import type { Chat } from '../types';

export function ChatModelSelect({ chat, defaultModel, disabled }: { chat?: Chat; defaultModel: string; disabled: boolean }) {
  const [models, setModels] = useState<ModelOption[]>([{ id: 'openrouter/free', label: 'Free router' }]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    getFreeModels().then(result => { if (active) setModels(result); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  function select(model: string) {
    if (disabled) return;
    if (!chat) useChatStore.getState().newChat();
    const id = chat?.id ?? useChatStore.getState().activeChatId;
    if (id) useChatStore.getState().setChatModel(id, model);
  }
  return <div className="min-w-0 max-w-[60%]">
    <select aria-label="Model for this chat" title="Override the Settings default for this chat" disabled={disabled} value={chat?.model ?? ''} onChange={e => select(e.target.value)} className="w-full rounded-lg px-2 py-1 text-xs" style={{ background: 'var(--bg-inset)', color: 'var(--text)' }}>
      <option value="">Settings default — {defaultModel}</option>
      {chat?.model && !models.some(m => m.id === chat.model) && <option value={chat.model}>{chat.model} (saved selection)</option>}
      {models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
    </select>
    {error && <p role="status" className="text-xs">Model list unavailable. Default and saved selection still work.</p>}
  </div>;
}
