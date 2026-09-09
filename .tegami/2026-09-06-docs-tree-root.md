---
packages:
  npm:fumapress: minor
---

### Select the sidebar tree root

The docs, notebook and glass layouts accept a `treeRoot` option: the folder path to use as the root of the sidebar tree, such as the `baseDir` of a content collection. Paths are matched against the folder itself, so the same value works on every locale, and an unknown path throws with the available folders.
