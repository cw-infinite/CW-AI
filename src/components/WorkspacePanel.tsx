import { useEffect, useMemo, useRef, useState } from 'react';
import { collectMemories } from '../lib/memory';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { backupWorkspace, restoreWorkspace } from '../lib/appwrite';
import { download } from '../lib/projects';
import { validateWorkspace } from '../lib/workspace';

export function WorkspacePanel({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  const { user, busy, login, logout, error } = useAuthStore();
  const chats = useChatStore(s => s.chats);
  const memoryEnabled = useChatStore(s => s.memoryEnabled);
  const forgottenMemoryIds = useChatStore(s => s.forgottenMemoryIds);
  const memories = useMemo(() => collectMemories(chats, forgottenMemoryIds), [chats, forgottenMemoryIds]);
  const [memorySearch, setMemorySearch] = useState('');
  const matchingMemories = memories.filter(m => m.text.toLowerCase().includes(memorySearch.toLowerCase()));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);
  async function run(action: () => Promise<void>) {
    setWorking(true); setStatus('');
    try { await action(); } catch (e) { setStatus(e instanceof Error ? e.message : 'Operation failed.'); }
    finally { setWorking(false); }
  }
  const snapshot = () => { const { chats, memoryEnabled, forgottenMemoryIds } = useChatStore.getState(); return { chats, memoryEnabled, forgottenMemoryIds }; };
  return <div className="workspace-backdrop" onClick={onClose}>
    <section ref={panel} role="dialog" aria-modal="true" aria-label="Account and memory" className="workspace-panel" onClick={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)') ?? [])].filter(el => !el.closest('fieldset:disabled'));
        const first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      <div className="flex items-center justify-between"><h2>Account & memory</h2><button onClick={onClose} aria-label="Close account panel">✕</button></div>
      <p>{user ? `Signed in as ${user.email}` : 'Guest workspace · saved on this browser'}</p>
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={busy || working}>
        {!user ? <form onSubmit={e => { e.preventDefault(); void run(async () => { await login(email, password, register); setPassword(''); setStatus('Signed in. Your account has its own workspace; guest chats remain on this browser.'); }); }}>
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Password<input type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <div className="flex gap-2"><button type="submit">{register ? 'Create account' : 'Sign in'}</button><button type="button" onClick={() => setRegister(!register)}>{register ? 'Already registered?' : 'Create an account'}</button></div>
        </form> : <div className="flex flex-wrap gap-2">
          <button onClick={() => void run(async () => { await backupWorkspace(user.$id, snapshot()); setStatus('Private cloud backup saved. Backups are versioned; manage old copies in Appwrite Storage.'); })}>Back up to cloud</button>
          <button onClick={() => void run(async () => { const workspace = await restoreWorkspace(user.$id); if (window.confirm('Replace this local workspace with your latest cloud backup? Export first if you need to keep local changes.')) { useChatStore.getState().replaceWorkspace(workspace); setStatus('Cloud backup restored.'); } })}>Restore cloud backup</button>
          <button onClick={() => void run(logout)}>Sign out</button>
        </div>}
        <h3>Automatic memory</h3>
        <p>Relevant topics, preferences, and decisions from your conversations help personalize future answers. There’s nothing to fill in.</p>
        <button aria-pressed={memoryEnabled} onClick={() => useChatStore.getState().setMemoryEnabled(!memoryEnabled)}>Automatic memory {memoryEnabled ? 'on' : 'off'}</button>
        <p>{memories.length} details available from this workspace. Only relevant details and a few preferences are recalled. Forget excludes a detail from automatic recall; its original chat message stays in history and may still be in recent conversation context.</p>
        {!!memories.length && <input aria-label="Search automatic memories" placeholder="Find a remembered topic…" value={memorySearch} onChange={e => setMemorySearch(e.target.value)} />}
        <div className="max-h-64 overflow-auto">
          {matchingMemories.slice(0, 40).map(m => <div key={m.id} className="border-b border-[var(--border)] py-3">
            <span className="text-xs opacity-60">{m.kind} · {m.title}</span>
            <p>{m.text}</p>
            <button onClick={() => useChatStore.getState().forgetMemory(m.id)} aria-label={`Forget: ${m.text}`}>Forget</button>
          </div>)}
          {!memories.length && <p>Memory grows automatically as you chat.</p>}
          {matchingMemories.length > 40 && <p>Showing 40 of {matchingMemories.length}. Search to find a specific detail.</p>}
        </div>
        <h3>Portable workspace</h3>
        <p>Export chats and memory together. Your OpenRouter key and password are never included. Cloud backup and restore are manual.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => download(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }), 'cwai-workspace.json')}>Export workspace</button>
          <label className="file-import">Import workspace<input type="file" accept=".json" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(async () => { if (file.size > 50_000_000) throw new Error('Import limit is 50 MB.'); const workspace = validateWorkspace(JSON.parse(await file.text())); if (window.confirm('Replace this workspace with the imported chats and memory?')) { useChatStore.getState().replaceWorkspace(workspace); setStatus('Workspace imported.'); } }); }} /></label>
        </div>
      </fieldset>
      {(status || working || busy) && <p role="status">{working || busy ? 'Working…' : status}</p>}
    </section>
  </div>;
}
