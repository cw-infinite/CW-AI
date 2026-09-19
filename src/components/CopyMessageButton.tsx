import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyMessageButton({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
    timer.current = setTimeout(() => setStatus('idle'), 3000);
  }
  return <div className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
    <button type="button" aria-label={label} onClick={() => void copy()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-[var(--bg-inset)]">
      {status === 'copied' ? <Check size={13} /> : <Copy size={13} />} {status === 'copied' ? 'Copied!' : 'Copy'}
    </button>
    <span role="status">{status === 'error' ? 'Copy failed. Select the text and copy it manually.' : status === 'copied' ? ' Text copied.' : ''}</span>
  </div>;
}
