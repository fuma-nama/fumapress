---
packages:
  npm:fumapress: minor
---

### Select the sidebar tree root

The docs, notebook and glass layouts accept a `treeRoot` option: the folder path to use as the root of the sidebar tree, such as the `baseDir` of a content collection, or a function selecting it per page. Locale and fallback id prefixes are handled for you, and an unknown path throws with the available folders.
