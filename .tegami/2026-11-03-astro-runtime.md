---
packages:
  "npm:@fumapress/astro": minor
  "npm:create-fumapress": patch
  "npm:@fumapress/ai": patch
---

### Fumapress on Astro

- Added `@fumapress/astro`: the site of `press.config.tsx` on Astro, with the plugins, layouts and search of Fumapress.
- `create-fumapress --framework astro` scaffolds an Astro site.
- `mcpPlugin()` of `@fumapress/ai` runs on every Fumapress runtime, and `fumapress` is an optional peer of `@fumapress/ai`.
