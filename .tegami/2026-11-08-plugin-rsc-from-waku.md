---
packages:
  "npm:fumapress": patch
---

### Fixed sites with an old `@vitejs/plugin-rsc` in the lockfile

- Fumapress uses the `@vitejs/plugin-rsc` of Waku. A lockfile from Fumapress 1 no longer installs a second copy that fails every page.
