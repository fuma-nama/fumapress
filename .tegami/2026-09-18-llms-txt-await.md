---
packages:
  "npm:fumapress": patch
---

### Fix `/llms.txt` content

`/llms.txt` was written as the literal string `[object Promise]` because the generated index was stringified instead of awaited. It now serves the real index. `/llms-full.txt` and the per-page `.md` routes were unaffected.
