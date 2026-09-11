// sterlingai.net: static site (Workers assets) + canonical-host redirects. No other logic, no secrets.
//  - www.sterlingai.net -> sterlingai.net (hostname check).
//  - http -> https, decided from Cloudflare's `cf-visitor` header (the edge always sets it in
//    production). `wrangler dev` presents the request as http://sterlingai.net without that header,
//    so local runs serve the assets instead of bouncing to https.
const CANONICAL = 'sterlingai.net';
function visitorScheme(request) {
  try { return JSON.parse(request.headers.get('cf-visitor') || '{}').scheme || null; } catch { return null; }
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
    return env.ASSETS.fetch(request);
  },
};
