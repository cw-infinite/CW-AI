export interface ProjectFile { path: string; content: string; inferred?: boolean }
const extensions: Record<string, string> = { javascript: 'js', js: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts', tsx: 'tsx', html: 'html', css: 'css', json: 'json', python: 'py', py: 'py', bash: 'sh', shell: 'sh', sh: 'sh', markdown: 'md', md: 'md', yaml: 'yaml', yml: 'yml', sql: 'sql', vue: 'vue', svelte: 'svelte' };
function safePath(path: string) {
  return path.length <= 240 && !path.startsWith('/') && !/[:<>"|?*]/.test(path) && ![...path].some(c => c.charCodeAt(0) < 32) &&
    !path.split('/').some(p => !p || p === '..' || p === '.' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p));
}
export function extractFiles(text: string, snippetPrefix = 'snippets'): ProjectFile[] {
  const files = new Map<string, ProjectFile>();
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let block = 0;
  for (let i = 0; i < lines.length; i++) {
    const opening = lines[i].match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!opening) continue;
    const start = i;
    const fence = opening[1];
    const info = opening[2].trim();
    const close = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`);
    let end = i + 1;
    while (end < lines.length && !close.test(lines[end])) end++;
    if (end === lines.length) break; // Never export a cut-off file as complete.
    i = end;
    block++;
    const explicit = info.match(/\b(?:file|filename|title)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/i);
    let filename = explicit ? explicit[1] ?? explicit[2] ?? explicit[3] : undefined;
    if (!filename) {
      const label = lines.slice(0, start).reverse().find(line => line.trim())?.trim() ?? '';
      // Common outputs: ```src/App.tsx, ```tsx src/App.tsx, or ### **src/App.tsx**.
      const candidate = info.split(/\s+/).find(t => /^(?:[\w.@-]+\/)*[\w@-]+\.[\w.-]+$/.test(t));
      const heading = label.replace(/^#{1,6}\s*/, '').replace(/^\d+[.)]\s*/, '').replace(/^(?:file|filename):\s*/i, '').replace(/[*`]/g, '').replace(/:$/, '').trim();
      filename = candidate ?? (/^(?:[\w.@-]+[/\\])*[\w@.-]+\.[\w.-]+$/.test(heading) ? heading : undefined);
    }
    const inferred = !filename;
    const language = info.split(/\s+/)[0].toLowerCase();
    const path = (filename ?? `${snippetPrefix}/code-${block}.${extensions[language] ?? 'txt'}`).replace(/\\/g, '/');
    if (!safePath(path)) continue;
    files.set(path, { path, content: lines.slice(start + 1, end).join('\n') + '\n', ...(inferred ? { inferred: true } : {}) });
  }
  return [...files.values()];
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function downloadProject(files: ProjectFile[]) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  files.forEach(f => zip.file(f.path, f.content));
  download(await zip.generateAsync({ type: 'blob' }), 'project.zip');
}
