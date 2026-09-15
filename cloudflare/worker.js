// sterlingai.net Worker: static site (Workers assets) + canonical-host redirects + API proxy. No secrets.
//  - www.sterlingai.net -> sterlingai.net (hostname check).
//  - http -> https, decided from Cloudflare's `cf-visitor` header (the edge always sets it in
//    production). `wrangler dev` presents the request as http://sterlingai.net without that header,
//    so local runs serve the assets instead of bouncing to https.
//  - /mcp, /health and /v1/* are proxied to the Sterling ASP backend (HalTwin/sterling-asp on Render).
//    The upstream body is streamed through untouched, so MCP's Streamable HTTP / SSE
//    (text/event-stream) is never buffered. Everything else is served from the static assets.
const CANONICAL = 'sterlingai.net';
const API_ORIGIN = 'https://sterling-asp.onrender.com';
const API_PATH = /^\/(mcp|health)$|^\/v1(\/|$)/;
const API_ORIGIN_RE = /^https?:\/\/sterling-asp\.onrender\.com/;

function visitorScheme(request) {
  try { return JSON.parse(request.headers.get('cf-visitor') || '{}').scheme || null; } catch { return null; }
}

async function proxyApi(request, url) {
  const upstream = new URL(url.pathname + url.search, API_ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete('host');                       // the subrequest's Host comes from the upstream URL
  headers.set('accept-encoding', 'identity');   // no gzip/br from Render: a compressed SSE stream gets
                                                // buffered by the encoder and the MCP handshake stalls
  headers.set('x-forwarded-host', url.hostname);
  headers.set('x-forwarded-proto', 'https');
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const resp = await fetch(upstream.toString(), {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',                         // pass 3xx through instead of following them here
  });
  const out = new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
  const loc = out.headers.get('location');      // an upstream redirect must not leak the Render hostname
  if (loc && API_ORIGIN_RE.test(loc)) out.headers.set('location', loc.replace(API_ORIGIN_RE, 'https://' + CANONICAL));
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const wrongHost = url.hostname === 'www.' + CANONICAL;
    const insecure = visitorScheme(request) === 'http';
    if (wrongHost || insecure) {
      url.protocol = 'https:';
      url.hostname = CANONICAL;
      return Response.redirect(url.toString(), 301);
    }
    if (API_PATH.test(url.pathname)) return proxyApi(request, url);
    return env.ASSETS.fetch(request);
  },
};
