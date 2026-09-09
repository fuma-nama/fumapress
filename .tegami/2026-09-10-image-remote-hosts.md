---
packages:
  npm:fumapress: patch
---

### Same-origin redirects no longer need `allowedHosts`

Self-hosted image optimization resolves a local `src` against the site's own URL before fetching it. When that request redirected, even to the same origin, the target was checked against `allowedHosts` and refused, so a plain `/cover.png` could fail to optimize on hosts that redirect their own assets. Redirects within one origin are now followed; leaving it still requires an entry.

### Vercel image options are applied

`remotePatterns`, `domains`, `localPatterns`, `formats`, `minimumCacheTTL`, `contentDispositionType` and `contentSecurityPolicy` of the Vercel image plugin were dropped instead of written to the build output, so remote images could not be allowed at all. They now reach `.vercel/output/config.json`.
