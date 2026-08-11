---
packages:
  "npm:fumapress": patch
---

### Fix tag links on the blog tags page

The tags page hardcoded `/blog/tags/{tag}` for every tag, so a `blogPlugin` configured with a custom
`paths.tags` linked to a route that was never generated, and localized sites dropped the locale
prefix. Both cases returned 404. Links now resolve against the configured tags path and the current
locale, matching the tag links already rendered on blog posts.
