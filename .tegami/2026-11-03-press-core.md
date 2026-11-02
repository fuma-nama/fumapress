---
packages:
  "npm:fumapress": minor
  "npm:@fumapress/core": minor
  "npm:@fumapress/ai": patch
  "npm:@fumapress/graphql": minor
  "npm:@fumapress/notion": minor
  "npm:@fumapress/sanity": minor
  "npm:@fumapress/obsidian": minor
---

### Refactored onto `@fumapress/core`

- Added `@fumapress/core`: the engine, site config and plugins of Fumapress, shared by every framework. Its plugins extend the framework plugins of `fumadocs-core/framework/plugin`.
- Plugins of integrations, like `openapiPlugin()` of `fumadocs-openapi/plugin`, work in Fumapress as-is.
- Plugins can add routes, head tags, page slots and page data with the hooks of `@fumapress/core`. The Waku hooks, adapters and `this.data` keep working.
- Takumi images are served under `/og`, set `basePath` to change it.
- Link validation checks the links in the Markdown of pages, against pages, headings, plugin routes and the pages of `src/pages`.
- AI search indexes the pages of every plugin with page text, like OpenAPI pages.
- Deprecated `@fumapress/graphql`, `@fumapress/notion`, `@fumapress/sanity` and `@fumapress/obsidian`: use the `/plugin` export of the Fumadocs integration.
