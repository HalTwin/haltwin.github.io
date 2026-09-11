# sterlingai.net on Cloudflare

The Sterling website (this repo's GitHub Pages files: `index.html`, `terminal.html`, `discord/`,
`favicon.svg`, `og-image.png`) served from a Cloudflare Worker with static assets, under the
**Ryanmo.photo@gmail.com** Cloudflare account (`f2a1cb443cfb87b526fac0886f1b34c8`), Worker `sterlingai`,
custom domains **sterlingai.net** and **www.sterlingai.net** (www and plain http 301 to
`https://sterlingai.net`). Cloudflare Registrar + zone for `sterlingai.net` live in the same account.

```sh
cloudflare/build.sh                 # -> cloudflare/dist (copies the 5 files, rewrites https://sterlingai.xyz -> https://sterlingai.net in HTML)
cd cloudflare && wrangler deploy    # needs `wrangler login` as ryanmo.photo@gmail.com
```

Notes
- `og:url` / `og:image` / `twitter:image` in `index.html` point at `sterlingai.xyz` (parked by its
  registrar since 2026-09-10); `build.sh` rewrites them for this domain and fails if any `.xyz` is left.
- DNS for `sterlingai.net` / `www.sterlingai.net` is **created and owned by the Workers custom domains**.
  Do not add manual A/AAAA/CNAME records for those two names: the custom-domain API refuses hostnames
  that already have externally managed records (error 100117) — that is why the first attempt on
  2026-09-10 failed until the manual records were removed.
- `assets.run_worker_first: true` is required: otherwise asset paths are served before `worker.js`
  runs and the www/http redirects only apply to non-asset paths.
- Paths: Workers assets serve `/terminal.html` via a 307 to `/terminal` and `/discord` via `/discord/`;
  links in `index.html` (`terminal.html`, `/discord`) keep working.
- GitHub Pages (haltwin.github.io) still serves the same files; the deployed site on sterlingai.net
  is whatever `build.sh` copied at deploy time — redeploy after changing the HTML.
