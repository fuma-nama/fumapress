---
packages:
  npm:fumapress: minor
---

### Static deployment output

The deployment adapter now receives the render mode: with `mode: "static"`, Cloudflare deploys static assets without a Worker, Vercel and Netlify emit no function. No custom server entry needed.

Cloudflare and Netlify builds write `dist/public/_headers` to cache hashed assets for a year, unless your project has its own `public/_headers`. Static builds on Cloudflare also set `not_found_handling: "404-page"` in the generated `wrangler.jsonc`, so unknown URLs get the `404.html` page.

### Base URL fallback

The `site.baseUrl` fallback no longer reads the Cloudflare Pages variables, which Workers Builds never sets. The warning now says when Workers Builds is detected, since it exposes no site URL.
