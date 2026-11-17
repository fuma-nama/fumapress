---
packages:
  "npm:@fumapress/core": minor
---

### Files for agents in `llmsPlugin()`

- `/llms.txt` links pages to their Markdown, like `/docs/install.md`.
- Root folders get their own `llms-full.txt`, like `/docs/llms-full.txt`, linked from their line in `/llms.txt`, so large docs can be read section by section.
- Added the `section` option, which chooses the sections, and can collapse a section into one link to its own `llms.txt`.
- Added the `filter` option, which leaves pages out of the files.
- Pages link their Markdown in `<head>` with `<link rel="alternate" type="text/markdown">`.
- Needs Fumadocs 16.19.3 or later.
