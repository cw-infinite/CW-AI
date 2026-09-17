import type { ChatMessage } from '../types';

export function resolveOutputLimit(requested: number, modelLimit?: number | null): number | undefined {
  if (requested === 0) return undefined;
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(131072, Math.floor(requested))) : 16384;
  return modelLimit && modelLimit > 0 ? Math.min(limit, modelLimit) : limit;
}
export function isOutputLimited(message: ChatMessage): boolean {
  return !!message.truncated || !!message.error?.startsWith('The response reached its output limit.');
}
