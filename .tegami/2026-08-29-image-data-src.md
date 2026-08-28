---
packages:
  npm:fumapress: patch
---

### Treat `data:` images as unoptimized

Vite inlines a small image as a `data:` URL at build time. `Image` sent this URL to the image
optimizer. An optimizer cannot fetch a `data:` URL, so Vercel returned `400 INVALID_IMAGE_OPTIMIZE_REQUEST`
and the image did not show. `Image` now treats a `data:` src as unoptimized and renders a plain `<img>`.
