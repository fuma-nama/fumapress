---
packages:
  "npm:@fumapress/mintlify": patch
---

### Mintlify migration works on Astro

- `mintlifyPlugin()` works on Waku and Astro.
- The sidebar from `navigation` is the page tree of the site, every layout uses it.
- The navbar, `appearance` and `search.prompt` apply under your own `ui.baseOptions` and `ui.providerProps`, which win.
- `errors.404` is the 404 page on both frameworks, and `redirects` apply on both.
- Without a home page, the 404 redirect goes to the first page of the language.
- `fumapress`, `waku` and `hono` are no longer peer dependencies.
