---
packages:
  "npm:fumapress": minor
  "npm:@fumapress/core": minor
  "npm:@fumapress/ai": patch
  "npm:@fumapress/feedback": patch
  "npm:@fumapress/graphql": minor
  "npm:@fumapress/notion": minor
  "npm:@fumapress/sanity": minor
  "npm:@fumapress/obsidian": minor
---

### Refactored onto `@fumapress/core`

- Added `@fumapress/core`: the engine, site config and plugins of Fumapress, shared by every framework. Its plugins extend the framework plugins of `fumadocs-core/framework/plugin`.
- Plugins of integrations, like `openapiPlugin()` of `fumadocs-openapi/plugin`, work in Fumapress as-is.
- `@fumapress/core` exports the helpers of runtimes: `recommendedPreset()`, `expandRoute()`, `matchRoute()`, `stripBase()`, `renderSlot()`, `wrapSlot()`, `crawlFrameworkPkgs()` of `@fumapress/core/vite`, and the `trailingSlash` option of runtimes.
- Plugins can add routes, head tags, page slots and page data with the hooks of `@fumapress/core`. The Waku hooks, adapters and `this.data` keep working.
- AI search indexes the pages of every plugin with page text, like OpenAPI pages.
- Deprecated `@fumapress/graphql`, `@fumapress/notion`, `@fumapress/sanity` and `@fumapress/obsidian`: use the `/plugin` export of the Fumadocs integration.
- `@fumapress/notion` re-exports `@fumadocs/notion` instead of shipping a copy of it.
- Feedback of `@fumapress/feedback` also shows on pages of the glass layout.
- Fixed the Markdown URL of pages under a base path, and the robots.txt sitemap link of a custom sitemap `path`.
- Sitemaps escape `&` in alternate links, Markdown served to agents is `Cache-Control: private`, and URLs with a trailing slash negotiate Markdown too.
- Link validation no longer reports links rendered by its own requests.
- `openapiPlugin()` reports a proxy in static mode with the error of `fumadocs-openapi/plugin`.
