import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, Monitor, Sun, Moon, Trash2, ExternalLink } from "lucide-react";
import { useSettingsStore, ACCENT_PRESETS } from "../store/useSettingsStore";
import { useChatStore } from "../store/useChatStore";
import { SUGGESTED_MODELS } from "../lib/openrouter";
import type { ThemeMode } from "../types";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "라이트", icon: Sun },
  { value: "dark", label: "다크", icon: Moon },
  { value: "system", label: "시스템", icon: Monitor },
];

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { connection, theme, accent, setApiKey, setModel, setTheme, setAccent } = useSettingsStore();
  const clearAllChats = useChatStore((s) => s.clearAllChats);
  const [showKey, setShowKey] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.35)" }}
          />
          <motion.div
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[400px] flex-col shadow-[var(--shadow-panel)]"
            style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}
          >
            <div
              className="flex h-14 shrink-0 items-center px-5"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <h2 className="text-[15px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}>
                설정
              </h2>
              <div className="flex-1" />
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-[var(--bg-inset)]"
              >
                <X size={17} style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {/* Connection */}
              <section className="mb-8">
                <SectionTitle>OpenRouter 연결</SectionTitle>

                <Label>API 키</Label>
                <div className="relative mb-4">
                  <input
                    type={showKey ? "text" : "password"}
                    value={connection.apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full rounded-[var(--radius-md)] px-3 py-2.5 pr-10 text-[13.5px] outline-none"
                    style={{ background: "var(--bg-inset)", border: "1px solid var(--border)", color: "var(--text)" }}
                  />
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md hover:bg-[var(--border)]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="mb-5 flex items-center gap-1 text-[12.5px] transition-colors hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  OpenRouter에서 API 키 발급받기
                  <ExternalLink size={11} />
                </a>

                <Label>Model</Label>
                <input
                  id="modelName"
                  value={connection.model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="예: openai/gpt-5"
                  className="mb-2 w-full rounded-[var(--radius-md)] px-3 py-2.5 text-[13.5px] outline-none"
                  style={{ background: "var(--bg-inset)", border: "1px solid var(--border)", color: "var(--text)" }}
                />
                <div className="flex flex-wrap gap-1.5">
                  {/* TODO this is the way to go. */}
                  {/* first get the api and get free models.
                  first addition: get list of them and make them as easy buttons here
                  2. make them as a small search compoent + with table
                  3. make the table include bunch of information in a small list. */}
                  {SUGGESTED_MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setModel(m.id)}
                      className="rounded-full px-2.5 py-1 text-[12px] transition-colors"
                      style={{
                        background: connection.model === m.id ? "var(--accent-soft)" : "var(--bg-inset)",
                        color: connection.model === m.id ? "var(--accent)" : "var(--text-secondary)",
                        border: `1px solid ${connection.model === m.id ? "var(--accent-border)" : "var(--border)"}`,
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  openrouter.ai/models 에서 사용 가능한 전체 모델명을 확인할 수 있습니다.
                </p>
              </section>

              {/* Appearance */}
              <section className="mb-8">
                <SectionTitle>테마</SectionTitle>
                <div className="mb-5 grid grid-cols-3 gap-2">
                  {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className="flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] py-3 text-[12.5px] transition-colors"
                      style={{
                        background: theme === value ? "var(--accent-soft)" : "var(--bg-inset)",
                        color: theme === value ? "var(--accent)" : "var(--text-secondary)",
                        border: `1px solid ${theme === value ? "var(--accent-border)" : "var(--border)"}`,
                      }}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  ))}
                </div>

                <Label>강조 색상</Label>
                <div className="flex flex-wrap gap-2.5">
                  {ACCENT_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setAccent(preset)}
                      title={preset.name}
                      className="grid h-8 w-8 place-items-center rounded-full transition-transform hover:scale-110"
                      style={{
                        background: `hsl(${preset.h} ${preset.s}% 55%)`,
                        outline: accent.name === preset.name ? "2px solid var(--text)" : "none",
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label>사용자 지정 색조</Label>
                    <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                      {accent.h}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={accent.h}
                    onChange={(e) => setAccent({ name: "사용자 지정", h: Number(e.target.value), s: accent.s })}
                    className="w-full accent-[var(--accent)]"
                    style={{
                      background: `linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) => `hsl(${i * 30} ${accent.s}% 55%)`).join(",")})`,
                      height: 8,
                      borderRadius: 999,
                      appearance: "none",
                    }}
                  />
                </div>
              </section>

              {/* Data */}
              <section>
                <SectionTitle>데이터</SectionTitle>
                {confirmClear ? (
                  <div className="flex items-center gap-2 rounded-[var(--radius-md)] p-3" style={{ background: "var(--danger-soft)" }}>
                    <span className="flex-1 text-[12.5px]" style={{ color: "var(--danger)" }}>
                      모든 대화가 영구적으로 삭제됩니다.
                    </span>
                    <button
                      onClick={() => {
                        clearAllChats();
                        setConfirmClear(false);
                      }}
                      className="rounded-md px-2.5 py-1.5 text-[12.5px] font-medium"
                      style={{ background: "var(--danger)", color: "#fff" }}
                    >
                      삭제
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="rounded-md px-2.5 py-1.5 text-[12.5px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 text-[13px] transition-colors"
                    style={{ color: "var(--danger)", border: "1px solid var(--border)" }}
                  >
                    <Trash2 size={14} />
                    모든 대화 삭제
                  </button>
                )}
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
      {children}
    </h3>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
      {children}
    </label>
  );
}
