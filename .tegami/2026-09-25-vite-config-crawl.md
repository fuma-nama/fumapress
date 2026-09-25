---
packages:
  npm:fumapress: patch
---

## Faster Vite config generation

The dependency crawl now reads each package once, keeps the shortest chain for every CommonJS dependency, and is memoized until the package manager's install state changes.

It also stops pre-bundling declaration-only packages such as `@types/mdx`, which made esbuild fail on type-space imports.
