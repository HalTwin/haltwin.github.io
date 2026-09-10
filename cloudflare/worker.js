// sterlingai.net: static site (Workers assets) + canonical-host redirects. No other logic, no secrets.
// The zone's DNS for the apex and www is proxied (currently still pointing at GitHub Pages); the
// Worker is attached with zone routes, so it answers for both hosts regardless of those records.
const CANONICAL = 'sterlingai.net';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || url.hostname !== CANONICAL) {
      url.protocol = 'https:';
      url.hostname = CANONICAL;
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
