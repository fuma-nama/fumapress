---
packages:
  npm:fumapress: minor
---

### Search plugin options

`oramaSearchPlugin()` and `flexsearchPlugin()` now accept every option of `createFromSource()` and `flexsearchFromSource()` from Fumadocs, not only `buildIndex`. Pass a `tokenizer` with a stemmer, `search` options or a FlexSearch `localeMap` without reimplementing the plugin.

Search works for every language out of the box with Orama Search (ZBSearch), including Chinese, Japanese and Korean. The deprecated `localeMap` of ZBSearch is not exposed.
