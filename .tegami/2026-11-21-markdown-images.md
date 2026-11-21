---
packages:
  "npm:fumapress": patch
---

### Markdown images load lazily

- Markdown images load lazily without a preload, like `next/image`. Images with `priority` load eagerly and are preloaded.
