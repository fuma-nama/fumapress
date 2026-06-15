---
"fumapress": patch
---

Fix i18n: the blog index, blog tags-list, and localized 404 pages were registered under numeric locale paths (`/0`, `/1`, …) instead of locale codes, because their `staticPaths` used `Object.keys(i18nConfig.languages)` on the `languages` array (which yields its indices). Use the `languages` array directly.
