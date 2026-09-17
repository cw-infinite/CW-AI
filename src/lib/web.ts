export interface WebSource { title: string; url: string; excerpt: string }
export async function research(query: string, signal: AbortSignal): Promise<WebSource[]> {
  const url = query.match(/https:\/\/[^\s<>]+/)?.[0];
  if (url) {
    const res = await fetch(`/api/read?url=${encodeURIComponent(url)}`, { signal });
    if (!res.ok) throw new Error('Page could not be read. Start the web server with npm run server, and use a public HTTPS page.');
    const page = await res.json();
    const doc = new DOMParser().parseFromString(page.html, 'text/html');
    doc.querySelectorAll('script,style,nav,footer,header,iframe,svg,form').forEach(el => el.remove());
    const excerpt = (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 14000);
    if (!excerpt) throw new Error('This page has no readable text. Try another source.');
    return [{ title: doc.title || url, url: page.url, excerpt }];
  }
  const params = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: query.slice(0, 300), gsrlimit: '4', prop: 'extracts|info', exintro: '1', explaintext: '1', exchars: '2500', inprop: 'url', format: 'json', origin: '*' });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { signal });
  if (!response.ok) throw new Error(`Wikipedia search failed (${response.status}).`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.info || 'Search failed.');
  const pages = Object.values(data.query?.pages ?? {}) as { title: string; fullurl: string; extract: string; index: number }[];
  const sources = pages.sort((a, b) => a.index - b.index).map(p => ({ title: p.title, url: p.fullurl, excerpt: p.extract }));
  if (!sources.length) throw new Error('No Wikipedia results. Try a shorter topic or paste a public HTTPS URL.');
  return sources;
}
