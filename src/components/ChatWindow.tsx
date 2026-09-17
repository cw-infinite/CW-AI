import { PanelLeft } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import type { ImageAttachment } from "../types";
import { useState } from 'react';
import { WorkspacePanel } from './WorkspacePanel';
import { ProjectPanel } from './ProjectPanel';
import { useAuthStore } from '../store/useAuthStore';
import { McpPanel } from './McpPanel';
import { useMcpStore } from '../store/useMcpStore';

interface ChatWindowProps {
  sidebarCollapsed: boolean;
  onShowSidebar: () => void;
}

export function ChatWindow({ sidebarCollapsed, onShowSidebar }: ChatWindowProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const user = useAuthStore(s => s.user);
  const webEnabled = useChatStore(s => s.webEnabled);
  const projectMode = useChatStore(s => s.projectMode);
  const enabledMcp = useMcpStore(s => s.servers.filter(server => server.enabled));
  const chats = useChatStore((s) => s.chats);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const activeStreams = useChatStore((s) => s.activeStreams);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopGenerating = useChatStore((s) => s.stopGenerating);
  const retryLastMessage = useChatStore((s) => s.retryLastMessage);
  const model = useSettingsStore((s) => s.connection.model);

  const chat = chats.find((c) => c.id === activeChatId);
  const isStreaming = !!activeChatId && !!activeStreams[activeChatId];

  const handleSend = (text: string, images: ImageAttachment[]) => {
    sendMessage(text, images.length ? images : undefined);
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col" style={{ background: "var(--bg)" }}>
      <div
        className="flex h-14 shrink-0 items-center gap-2 px-4 sm:px-6"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {sidebarCollapsed && (
          <button
            onClick={onShowSidebar}
            className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-[var(--bg-inset)]"
          >
            <PanelLeft size={17} style={{ color: "var(--text-secondary)" }} />
          </button>
        )}
        <span className="truncate text-[14px] font-medium" style={{ color: "var(--text)" }}>
          {chat?.title ?? "새 대화"}
        </span>
        <div className="flex-1" />
        <span
          className="truncate rounded-full px-2.5 py-1 text-[11.5px]"
          style={{ background: "var(--bg-inset)", color: "var(--text-tertiary)" }}
        >
          {model || "모델 미설정"}
        </span>
      </div>

      <div className="workspace-toolbar">
        <button aria-pressed={webEnabled} onClick={() => useChatStore.getState().setWebEnabled(!webEnabled)}>◎ {webEnabled ? 'Web on' : 'Web off'}</button>
        <button aria-pressed={projectMode} onClick={() => useChatStore.getState().setProjectMode(!projectMode)}>⌘ Build project</button>
        <button aria-expanded={filesOpen} onClick={() => setFilesOpen(!filesOpen)}>Files</button>
        <button onClick={() => setMcpOpen(true)}>MCP ({enabledMcp.length})</button>
        <button className="ml-auto" onClick={() => setAccountOpen(true)}>{user ? 'Account & memory' : 'Sign in / Memory'}</button>
      </div>
      {webEnabled && <p className="workspace-hint">Free Wikipedia search, or paste an HTTPS URL to read a public page. Sources are sent to your selected model.</p>}
      {filesOpen && <ProjectPanel messages={chat?.messages ?? []} />}
      {chat && chat.messages.length > 0 ? (
        <MessageList key={chat.id} messages={chat.messages} onRetry={() => activeChatId && retryLastMessage(activeChatId)} />
      ) : (
        <EmptyState onPick={(text) => handleSend(text, [])} />
      )}

      <Composer
        isStreaming={isStreaming}
        onSend={handleSend}
        onStop={() => activeChatId && stopGenerating(activeChatId)}
      />
      {accountOpen && <WorkspacePanel onClose={() => setAccountOpen(false)} />}
      {mcpOpen && <McpPanel onClose={() => setMcpOpen(false)} />}
    </div>
  );
}
