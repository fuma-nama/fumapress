---
packages:
  npm:fumapress: patch
  npm:create-fumapress: patch
---

## Require `"type": "module"` in package.json

Without it, Vite emits `.mjs` server bundles and static generation fails with a cryptic
`Cannot find module 'dist/server/build.js'`. The CLI now stops early and tells you to add it.
