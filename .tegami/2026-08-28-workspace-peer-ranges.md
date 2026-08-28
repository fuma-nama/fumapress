---
packages:
  npm:@fumapress/ai: patch
  npm:@fumapress/feedback: patch
  npm:@fumapress/graphql: patch
  npm:@fumapress/language: patch
  npm:@fumapress/mintlify: patch
  npm:@fumapress/notion: patch
  npm:@fumapress/obsidian: patch
  npm:@fumapress/sanity: patch
  npm:@fumapress/tegami: patch
---

## Loosen `fumapress` dependency ranges

Peer dependencies on `fumapress` (and `@fumapress/*`) now publish as `^x.y.z` instead of an exact version pin, so these packages stay compatible with newer core releases without needing a re-release.
