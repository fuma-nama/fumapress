---
packages:
  "npm:@fumapress/core": minor
  "npm:fumapress": patch
  "npm:@fumapress/graphql": minor
  "npm:@fumapress/notion": minor
  "npm:@fumapress/sanity": minor
  "npm:@fumapress/obsidian": minor
---

### Added `@fumapress/core`

- Added `@fumapress/core`: the engine, site config and plugins of Fumapress, shared by the Waku and Astro runtimes. Sites import from `fumapress` or `@fumapress/astro`, plugin packages from `@fumapress/core`.
- A site is `createPress(content, { i18n, loaderOptions }).plugins(...).config({...})`: the content types the plugins, the content and plugins type `.config()`.
- Plugins are `Plugin<C, T>`, extending the framework plugins of `fumadocs-core/framework/plugin`. Plugins of integrations, like `openapiPlugin()` of `fumadocs-openapi/press`, work as-is.
- Plugin hooks: `routes({ createApi, createView })` for API routes and pages of plugins, `deriveRoutes(fns, { lang, routes })` for routes derived from the page routes, `middleware()`, `head()`, `slots()`, `baseOptions()`, `providerProps()`, `configureLoader()` and `build()`.
- `this.getPageRoutes()` lists the page routes: your own pages, the views and the pages of runtime hooks.
- Plugins owning the pages of a source render them with `getPageView(page, body)`, which receives the page body with its wrappers.
- `ui.renderPage` receives typed props for content pages and plugin views, and the items of the `actions` and `footer` slots in `props.actions` and `props.footer`. `UIOptions<typeof app>` types `ui` callbacks in their own files.
- The `layout.wrapper` slot wraps the layout of every page, `body.wrapper` the content of pages.
- Capabilities: a plugin `provides` one, others read its `api` with `this.getCapability()`. A listed plugin replaces the preset entry of its capability, `.filter((entry) => entry.provides !== "rss")` drops one.
- Search plugins give the root provider their dialog with `providerProps()`: `search: { SearchDialog, options }`. The search of an i18n site searches the language of the page.
- Two routes on one path are an error naming both; your own pages win over plugin views.
- Fixed the Markdown URL of pages under a base path, and the robots.txt sitemap link of a custom sitemap `path`.
- llms.txt and the Markdown of pages link full page URLs, with the base path.
- Sitemaps escape `&` in alternate links, Markdown served to agents is `Cache-Control: private`, and URLs with a trailing slash negotiate Markdown too.
- Link validation no longer reports links rendered by its own requests.
- `openapiPlugin()` reports a proxy in static mode with the error of `fumadocs-openapi/press`.

### Deprecated the integration packages

- Deprecated `@fumapress/graphql`, `@fumapress/notion`, `@fumapress/sanity` and `@fumapress/obsidian`: use the default export of `/press` of the Fumadocs integration.
- They depend on `@fumapress/core` instead of `fumapress`, and work on Waku and Astro.
- `@fumapress/notion` re-exports `@fumadocs/notion` instead of shipping a copy of it, `@notionhq/client` is a peer dependency.
- `@fumapress/obsidian` stops watching the vault when the site reloads.
