import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ChatMessage } from "../types";
import { isOutputLimited } from '../lib/outputLimits';

interface MessageBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end px-4 py-2 sm:px-0">
        <div className="flex max-w-[78%] flex-col items-end gap-2">
          {message.images && message.images.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {message.images.map((img) => (
                <img
                  key={img.id}
                  src={img.dataUrl}
                  alt={img.name}
                  className="h-32 w-32 rounded-[var(--radius-md)] object-cover"
                  style={{ border: "1px solid var(--border)" }}
                />
              ))}
            </div>
          )}
          {message.content && (
            <div
              className="whitespace-pre-wrap rounded-[var(--radius-lg)] px-4 py-2.5 text-[15px] leading-relaxed"
              style={{
                background: "var(--accent)",
                color: "var(--accent-contrast)",
                borderBottomRightRadius: 6,
              }}
            >
              {message.content}
            </div>
          )}
        </div>
      </div>
    );
  }

  // assistant message — no bubble chrome, editorial left rule instead
  const isEmpty = !message.content && message.streaming;

  return (
    <div className="px-4 py-2 sm:px-0">
      <div className="flex gap-3">
        <div
          className="mt-1.5 w-[3px] shrink-0 self-stretch rounded-full"
          style={{ background: message.error ? "var(--danger)" : "var(--accent-border)" }}
        />
        <div className="min-w-0 flex-1">
          {isEmpty ? (
            <ThinkingDots />
          ) : (
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ alt }) => <span>[Image: {alt}]</span>, a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{message.content}</ReactMarkdown>
              {message.streaming && <span className="stream-caret" />}
            </div>
          )}

          {message.contextInfo && <details className="text-xs mt-3 opacity-70"><summary>Context used</summary>{message.contextInfo}</details>}
          {!!message.toolActivity?.length && <details className="text-xs mt-2"><summary>MCP activity ({message.toolActivity.length})</summary>{message.toolActivity.map((item, index) => <p key={`${item.server}-${item.tool}-${index}`}>{item.status}: {item.server} / {item.tool}</p>)}</details>}
          {!!message.sources?.length && <details className="text-xs mt-2"><summary>Web sources ({message.sources.length})</summary>{message.sources.map(s => <div key={s.url} className="my-2"><a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.title}</a><p>{s.excerpt.slice(0, 250)}…</p></div>)}</details>}
          {isOutputLimited(message) && <p role="status" className="mt-3 text-sm">Response reached its output limit. Complete files are available under Files. Increase “Maximum response tokens” in Settings or ask for the remaining files, with any unfinished file rewritten in full.</p>}
          {message.error && !isOutputLimited(message) && (
            <div
              className="mt-2 flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-[13px]"
              style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              <AlertTriangle size={14} className="shrink-0" />
              <span className="flex-1">{message.error}</span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors hover:bg-black/5"
                >
                  <RefreshCw size={12} />
                  재시도
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: "var(--accent)",
            animation: `thinking-bounce 1.1s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes thinking-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
