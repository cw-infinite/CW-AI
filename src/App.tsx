import { useEffect, useState } from "react";
import { useAuthStore } from './store/useAuthStore';
import { useChatStore } from './store/useChatStore';
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { SettingsPanel } from "./components/SettingsPanel";
import { useAppliedTheme } from "./hooks/useAppliedTheme";

export default function App() {
  useAppliedTheme();
  const ready = useChatStore(s => s.ready);
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    const listener = (event: Event) => setStorageError((event as CustomEvent<string>).detail);
    window.addEventListener('storage-error', listener);
    void useAuthStore.getState().initialize();
    return () => window.removeEventListener('storage-error', listener);
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 700);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
    {!ready && <div role="status" className="fixed inset-0 z-[110] grid place-items-center" style={{ background: 'var(--bg)', color: 'var(--text)' }}>Opening your workspace…</div>}
    <div inert={!ready} className="flex h-screen w-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {storageError && <div role="alert" className="storage-warning">{storageError}<button onClick={() => setStorageError('')} aria-label="Dismiss storage warning">✕</button></div>}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <ChatWindow sidebarCollapsed={sidebarCollapsed} onShowSidebar={() => setSidebarCollapsed(false)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
    </>
  );
}
