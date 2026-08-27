---
packages:
  npm:fumapress: patch
---

### Accept string dates in `core:get-creation-date`

Fumadocs MDX serializes frontmatter as JSON, so a `date` field reaches the adapter as a string.
The hook only accepted `Date` objects and returned `undefined` otherwise, which made blog posts fall
back to the build time. It now parses strings, like `tegami:get-date` already did.
