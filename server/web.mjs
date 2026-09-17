import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';

export function publicIPv4(ip) {
  if (isIP(ip) !== 4) return false;
  const [a, b] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) || (a === 100 && b >= 64 && b <= 127));
}
export async function readPage(raw, redirects = 0) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Only public HTTPS URLs on port 443 are supported.');
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(a => !publicIPv4(a.address))) throw new Error('Private and reserved addresses are blocked.');
  // Pin the checked address to the connection, preventing DNS rebinding.
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      lookup: (_host, _options, callback) => callback(null, addresses[0].address, 4),
      family: 4,
      headers: { 'User-Agent': 'CWAI-Reader/1.0', Accept: 'text/html,text/plain', 'Accept-Encoding': 'identity' },
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (redirects >= 3 || !response.headers.location) return reject(new Error('Too many redirects.'));
        resolve(readPage(new URL(response.headers.location, url).href, redirects + 1)); return;
      }
      if (response.statusCode !== 200 || !/^text\/(html|plain)/.test(response.headers['content-type'] ?? '')) {
        response.resume(); reject(new Error('The page is unavailable or is not HTML/text.')); return;
      }
      let size = 0; const chunks = [];
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 2_000_000) request.destroy(new Error('Page exceeds the 2 MB reader limit.'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ url: url.href, html: Buffer.concat(chunks).toString('utf8') }));
    });
    const timer = setTimeout(() => request.destroy(new Error('Reader timed out.')), 12000);
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
  });
}

export function createWebServer() {
  let active = 0;
  return http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET' || url.pathname !== '/api/read') { res.writeHead(404).end('{}'); return; }
    if (active >= 4) { res.writeHead(429).end(JSON.stringify({ error: 'Reader busy.' })); return; }
    active++;
    try { res.end(JSON.stringify(await readPage(url.searchParams.get('url') ?? ''))); }
    catch (err) { res.writeHead(400).end(JSON.stringify({ error: err.message })); }
    finally { active--; }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createWebServer().listen(8787, '127.0.0.1', () => console.log('Web reader listening on http://127.0.0.1:8787'));
}
