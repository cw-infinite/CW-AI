import type { Chat, ChatMessage } from '../types';

export interface MemoryOptions { memoryEnabled: boolean; forgottenMemoryIds: string[] }
export interface MemoryItem {
  id: string; chatId: string; messageId: string; title: string;
  text: string; kind: 'preference' | 'decision' | 'topic'; createdAt: number;
}
const stopWords = new Set('the and for that this with have from what how can could would should please help want need about your you are was were been into just some then they them chat answer tell make using use does did not but also like'.split(' '));
export function memoryTerms(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []).filter(t => !stopWords.has(t)))];
}
const cache = new WeakMap<ChatMessage, { text: string; kind: MemoryItem['kind'] }[]>();
function extract(message: ChatMessage) {
  const cached = cache.get(message);
  if (cached) return cached;
  // Keep original user wording: never turn an assistant's guess into a user fact.
  const clean = message.content.replace(/```[\s\S]*?(?:```|$)/g, '').replace(/^>.*$/gm, '');
  const sentences = clean.split(/(?:[.!?]\s+|\n+)/).map(s => s.trim()).filter(Boolean);
  const result: { text: string; kind: MemoryItem['kind'] }[] = [];
  for (const sentence of sentences) {
    if (sentence.length < 15 || sentence.length > 600 || memoryTerms(sentence).length < 3) continue;
    // Best-effort omission of obvious credentials/contact details from recalled snippets.
    if (/https?:\/\/|\b(password|secret|api.?key|token|credit.card)\b|sk-[\w-]+|[\w.+-]+@[\w.-]+\.[a-z]+/i.test(sentence)) continue;
    const kind = /\b(i (?:am|'m|prefer|like|love|dislike|work|live|speak)|my (?:name|job|role|goal)|i'm)\b|선호|저는|나는/i.test(sentence) ? 'preference'
      : /\b(decided|decision|we will|let's use|we chose|requirement|must use)\b|결정|사용하자/i.test(sentence) ? 'decision' : 'topic';
    result.push({ text: sentence, kind });
  }
  const selected = result.sort((a, b) => Number(b.kind !== 'topic') - Number(a.kind !== 'topic')).slice(0, 4);
  cache.set(message, selected);
  return selected;
}
export function collectMemories(chats: Chat[], forgottenMemoryIds: string[] = []): MemoryItem[] {
  const forgotten = new Set(forgottenMemoryIds);
  const items: MemoryItem[] = [];
  for (const chat of chats) for (const message of chat.messages) {
    if (message.role !== 'user' || message.error || message.streaming) continue;
    for (const item of extract(message)) {
      const id = item.text.toLowerCase().replace(/\s+/g, ' ');
      if (!forgotten.has(id)) items.push({ ...item, id, chatId: chat.id, messageId: message.id, title: chat.title, createdAt: message.createdAt });
    }
  }
  const seen = new Set<string>();
  return items.sort((a, b) => b.createdAt - a.createdAt).filter(item => {
    const key = item.text.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function recallMemories(chats: Chat[], currentChatId: string, recentIds: Set<string>, query: string, options: MemoryOptions): MemoryItem[] {
  if (!options.memoryEnabled) return [];
  const terms = new Set(memoryTerms(query));
  const candidates = collectMemories(chats, options.forgottenMemoryIds).filter(m => m.chatId !== currentChatId || !recentIds.has(m.messageId));
  const frequency = new Map<string, number>();
  for (const m of candidates) for (const term of memoryTerms(m.text)) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  const ranked = candidates.map(m => {
    const matches = memoryTerms(m.text).filter(t => terms.has(t));
    const relevance = matches.reduce((sum, t) => sum + 1 + Math.log(1 + candidates.length / (frequency.get(t) ?? 1)), 0);
    return { m, score: relevance + (m.kind === 'preference' ? 1 : 0), matches: matches.length };
  }).filter(x => x.matches > 0 || x.m.kind === 'preference')
    .sort((a, b) => b.score - a.score || b.m.createdAt - a.m.createdAt);
  const selected: MemoryItem[] = [];
  let generalPreferences = 0;
  for (const { m, matches } of ranked) {
    if (!matches && generalPreferences++ >= 2) continue;
    selected.push(m);
    if (selected.length === 6) break;
  }
  return selected;
}
