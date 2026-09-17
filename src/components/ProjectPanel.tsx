import { useMemo, useState } from 'react';
import type { ChatMessage } from '../types';
import { extractFiles, download, downloadProject, type ProjectFile } from '../lib/projects';

export function ProjectPanel({ messages }: { messages: ChatMessage[] }) {
  const files = useMemo(() => {
    const merged = new Map<string, ProjectFile>();
    messages.forEach((m, index) => { if (m.role === 'assistant' && !m.streaming) extractFiles(m.content, `snippets/answer-${index + 1}`).forEach(f => merged.set(f.path, f)); });
    return [...merged.values()];
  }, [messages]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const file = files.find(f => f.path === selected) ?? files[0];
  if (!file) return <p className="workspace-hint">No complete code blocks found yet. Enable “Build project” and ask for complete files in fenced code blocks, with a filename above each block. If the answer stopped mid-file, ask it to rewrite that file in full.</p>;
  return <section className="project-panel" aria-label="Project files">
    <div className="flex flex-wrap gap-2 items-center"><strong>{files.length} project files</strong>
      <button onClick={() => void downloadProject(files).catch(e => setError(e.message))}>Download ZIP</button>
      <button onClick={() => download(new Blob([file.content], { type: 'text/plain' }), file.path.split('/').at(-1)!)}>Download file</button>
    </div>
    <p className="text-xs my-2">Latest complete version of each file. Code has not been executed or verified.</p>
    {files.some(f => f.inferred) && <p role="status" className="text-xs my-2">Some code blocks had no filename and were saved under snippets/. You can download them, but they may need to be renamed and assembled into a project.</p>}
    <p className="text-xs my-2">Only complete file blocks are included. If a response stopped early, this download may contain only part of the project.</p>
    <select aria-label="Select project file" value={file.path} onChange={e => setSelected(e.target.value)}>{files.map(f => <option key={f.path}>{f.path}</option>)}</select>
    <pre className="overflow-auto max-h-64 p-3 text-xs"><code>{file.content}</code></pre>
    {error && <p role="alert">{error}</p>}
  </section>;
}
