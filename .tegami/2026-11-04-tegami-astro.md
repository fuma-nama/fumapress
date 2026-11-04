---
packages:
  "npm:@fumapress/tegami": minor
---

### Changelog on Waku and Astro

- `changelogPlugin()` works on Waku and Astro, and no longer depends on `fumapress`.
- Refactored `changelogPlugin()` to take the source keys of the changelog: `changelogPlugin({ source: "changelog" })`, replacing `isChangelog`.
- The `changelog.index` page has typed `entries` in `ui.renderPage`, compose them with `ChangelogIndexView`.
- Refactored: `layouts`, `createChangelogLayout()`, `createChangelogIndexPage()` and `getChangelogContext()` are removed, customize the page in `ui.renderPage`.
- Entry dates come from the creation date of pages, like the `date` frontmatter.
- Other plugins read the changelog sources from `getProvider("changelog")`.
