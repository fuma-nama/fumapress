---
packages:
  "npm:fumapress": patch
---

### Serve the page tree once on Waku

- The page tree is a file fetched once by the browser, rather than in the payload of every page. Builds of 2000 pages no longer fail, and client navigation sends only the page.
- Lists of the tree in `ui.renderPage` are read-only: change them in `pageTree.transformers` of the loader.
