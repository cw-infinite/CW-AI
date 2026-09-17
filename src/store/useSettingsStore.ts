import { create } from "zustand";
import type { AccentColor, AppSettings, ThemeMode } from "../types";
import { loadJSON, saveJSON, STORAGE_KEYS } from "../lib/storage";

export const ACCENT_PRESETS: AccentColor[] = [
  { name: "인디고", h: 244, s: 75 },
  { name: "바이올렛", h: 271, s: 70 },
  { name: "블루", h: 213, s: 85 },
  { name: "틸", h: 172, s: 55 },
  { name: "로즈", h: 342, s: 70 },
  { name: "앰버", h: 32, s: 90 },
];

const DEFAULT_SETTINGS: AppSettings = {
  connection: { apiKey: "", model: "openrouter/free", maxOutputTokens: 16384 },
  theme: "system",
  accent: ACCENT_PRESETS[0],
};

interface SettingsState extends AppSettings {
  setApiKey: (apiKey: string) => void;
  setModel: (model: string) => void;
  setMaxOutputTokens: (tokens: number) => void;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
}

const persisted = loadJSON<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);

function persist(state: AppSettings) {
  saveJSON(STORAGE_KEYS.settings, state);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...persisted,
  connection: { ...DEFAULT_SETTINGS.connection, ...persisted.connection },
  setMaxOutputTokens: tokens => {
    const next = { ...get(), connection: { ...get().connection, maxOutputTokens: tokens } };
    set(next); persist(next);
  },

  setApiKey: (apiKey) => {
    const next = { ...get(), connection: { ...get().connection, apiKey } };
    set(next);
    persist(next);
  },
  setModel: (model) => {
    const next = { ...get(), connection: { ...get().connection, model } };
    set(next);
    persist(next);
  },
  setTheme: (theme) => {
    const next = { ...get(), theme };
    set(next);
    persist(next);
  },
  setAccent: (accent) => {
    const next = { ...get(), accent };
    set(next);
    persist(next);
  },
}));
