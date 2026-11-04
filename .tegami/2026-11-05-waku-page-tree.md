---
packages:
  "npm:fumapress": patch
---

### Serve the page tree once on Waku

- The page tree is a file fetched once per language, instead of being part of the RSC payload of every page. Builds of large sites no longer crash on Waku's build metadata.
- Client components receive the tree as a whole, passing only `tree.children` to one now throws. Read the children on the server, or pass the tree.
