---
packages:
  "npm:fumapress": patch
---

### Run on Cloudflare Workers and serve language roots on request

- Sites with a Worker start on Cloudflare with the generated Wrangler config.
- With `mode: "dynamic"`, a language root like `/cn` renders its page instead of a 404.
