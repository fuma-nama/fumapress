---
packages:
  "npm:fumapress": patch
---

### OG images and `basePath` on Cloudflare

- With `mode: "dynamic"`, the build writes OG images as static files: Workers can't load the native addon of Takumi.
- The generated Wrangler config sets `assets.base_path` for a `basePath`, which needs Wrangler 4.148 or later.
- The root of a `basePath` opened without its trailing slash hydrates on every host.
