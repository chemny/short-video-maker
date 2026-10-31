import dns from 'node:dns/promises';
import net from 'node:net';
// An explicit official-domain list anchors source identity; it is not a licence grant.
export const validatePublicUrl = async (value, allowedDomains, {allowLocal = false} = {}) => {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only unauthenticated HTTP(S) URLs are supported');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!allowedDomains.some((d) => host === d.toLowerCase() || host.endsWith(`.${d.toLowerCase()}`))) throw new Error(`Domain is not approved for this source/media request: ${host}`);
  if (!allowLocal) {
    const addresses = net.isIP(host) ? [{address: host}] : await dns.lookup(host, {all: true});
    const privateIp = (ip) => /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) || ip === '::1' || /^(f[cd]|fe[89ab])/i.test(ip) || ip.includes('::ffff:');
    if (!addresses.length || addresses.some(({address}) => privateIp(address))) throw new Error('Source URL resolves to a non-public network');
  }
  return url;
};

export const fetchPublic = async (value, domains, {maxBytes = 2 * 1024 * 1024, allowLocal = false, method = 'GET'} = {}) => {
  if (!['GET', 'HEAD'].includes(method)) throw new Error('Only GET/HEAD source reads are supported');
  let url = value;
  for (let redirects = 0; redirects <= 5; redirects++) {
    await validatePublicUrl(url, domains, {allowLocal});
    const response = await fetch(url, {method, redirect: 'manual', signal: AbortSignal.timeout(30000), headers: {'User-Agent': 'ShortVideoMaker/1.0 (source research)'}});
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location) throw new Error('Redirect has no location');
      url = new URL(location, url).href; continue;
    }
    if (!response.ok) {await response.body?.cancel(); throw new Error(`HTTP ${response.status} for ${url}; no bypass attempted`);}
    const length = Number(response.headers.get('content-length'));
    if (method === 'HEAD') return {url, body: Buffer.alloc(0), contentLength: length, contentType: response.headers.get('content-type') ?? '', fetchedAt: new Date().toISOString()};
    if (length > maxBytes) {await response.body?.cancel(); throw new Error(`Source exceeds ${maxBytes} bytes`);}
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxBytes) {throw new Error(`Source exceeds ${maxBytes} bytes`);}
      chunks.push(chunk);
    }
    return {url, body: Buffer.concat(chunks), contentType: response.headers.get('content-type') ?? '', fetchedAt: new Date().toISOString()};
  }
  throw new Error('Too many redirects');
};
