---
packages:
  npm:fumapress: minor
---

## Remove the `resolvePage()` plugin hook

Nothing implements it since the blog plugin moved to `renderPage()`, pages now always come from the
content source as-is.
