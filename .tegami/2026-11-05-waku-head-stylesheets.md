---
packages:
  "npm:fumapress": patch
---

### Keep stylesheets in `head` on client navigation

- Navigating between pages with a different number of head tags no longer throws when `head` has a stylesheet.
