---
packages:
  npm:fumapress: patch
---

### Use the Markdown renderer from Fumadocs

The renderer behind `fumapress/markdown` moved into Fumadocs, so `asMarkdown`, `md`, and
`renderToMarkdown` are now re-exports of `fumadocs-core/server`. The output is unchanged.

The `fumadocs-core` peer dependency now requires `16.15.3` or above.
