---
packages:
  "npm:fumapress": major
---

### Fumapress 2

- This release has breaking changes, follow the [migration guide](https://press.fumadocs.dev/docs/migrate).

### Changed the site config to `createPress()`

- `press.config` exports `createPress(content, options).plugins(...).config({...})`, replacing `defineConfig()`, `.adapters()` and `.layouts()`.
- Removed `loaderOptions`: its fields are options of `createPress()`, and `loaderPlugins` replaces `loaderOptions.plugins`.
- `.config()` is optional: `createPress(content).plugins(...)` is a complete site.
- `ui.renderPage(props)` renders every page, content pages and plugin views, typed by `props.type`. `props.renderDefault()` is the built-in UI: `layout` picks a Fumadocs layout, `layoutProps` and `pageProps` are typed by it, and `body`, `pageData`, `actions` and `footer` replace what it renders.
- Removed the layout factories of `fumapress/layouts/*`, use `renderDefault({ layout })` or the Fumadocs UI layouts directly in `ui.renderPage`. `selectTreeRoot(tree, "docs")` of `fumapress` replaces their `treeRoot` option.
- `ui.renderRoot` replaces `renderRoot` and also receives the styles as `head`. `ui.baseOptions` replaces `defaultLayoutProps`, `ui.translations` replaces `translations`, and the keyed `head` tags replace `meta`.
- `ui.providerProps` sets the root provider of every page, like `theme` or a custom `search.SearchDialog`.
- Removed `renderNotFound`. The 404 page is a custom `src/pages/404.tsx`, else a plugin view at `/404`, else the built-in page in the Home Layout.
- `preset` takes a list: `preset: []` replaces `preset: false`, and `recommendedPreset().filter((entry) => entry.provides !== "rss")` drops one entry.
- The MDX renderer is built in: `press({ components: "./src/components/mdx.tsx" })` of `fumapress/vite` replaces `fumadocsMdx()` of `fumapress/adapters/mdx`.
- `RenderPageProps<typeof app>`, `UIOptions<typeof app>`, `WakuRouteProps<typeof app, "/showcase/[slug]">` and `getPressContext<typeof app>()` type custom files, replacing `$context` and `.utils()`. `WakuRouteConfig` replaces `RouteConfig`.
- Update `fumadocs-core` and `fumadocs-ui` to 16.18.1 or later, and `fumadocs-mdx` to 15.5.0 or later.

### Changed rendering to be per route

- Removed the `mode` option, `this.mode` and `BuildMode`. Plugins read `this.getContentRender(source?)` instead.
- Pages of dynamic content sources render on demand, pages of static sources are prerendered, and one site can mix both.
- The `.md` file and OG image of a page follow its route. The sitemap, RSS, `llms.txt` and `llms-full.txt` are prerendered unless a content source is dynamic.
- Custom pages default to `render: "static"` and custom API routes to `render: "dynamic"`. A static API route sets `render: "static"` in `getConfig()`, and can set `staticPaths`.
- `flexsearchPlugin()` and `oramaSearchPlugin()` follow the content source: static sources export an index at `/api/search.json`, dynamic sources search on the server. `render` overrides it.
- A site with no route rendered on demand deploys as static files. On a platform, the `static` option of Waku in a server entry leaves out the function of the adapter.

### Changed the plugin API

- Plugins are `Plugin` of `fumapress`, replacing `PressPlugin`, and extend the framework plugins of `fumadocs-core/framework/plugin`. `PressContext<typeof app>` replaces `AppContext`.
- Hooks: `routes({ createApi, createView })`, `deriveRoutes()`, `middleware()`, `head()`, `slots()`, `baseOptions()`, `providerProps()`, `configureLoader()`, `transformPage()`, `getPageView()` and `build()`.
- The `waku` hooks `createPages`, `honoMiddleware` and `unstable_serverEntry` replace `createPages`, `createMiddlewares` and `unstable_onServerEntry`. Plugin layouts live in route groups only.
- A plugin `provides` a capability and others read its `api` with `this.getCapability()`. A listed plugin replaces the preset entry of its capability.
- `useLayoutProps()` of `fumapress/client` and `@fumapress/astro/client` returns the layout props that plugins give from client state, like the AI chat: spread it into a custom layout. The built-in UI applies them.
- `props.actions` starts with the built-in buttons, `markdown` and `view-options`.
- Slots reach `ui.renderPage` as `props.actions` and `props.footer`, which the built-in UI places on the Docs page. The `layout.wrapper` slot wraps the layout of every page, `body.wrapper` the content of pages.
- Removed `preinit`, `configureRoutes`, plugin `renderPage`, `this.data` and `Adapter`.
- `fumapress` exports the types that plugins use, like `Context`, `HeadTag`, `SlotItem` and `DocsPageData`.

### Removed packages and entries

- Removed `fumapress/plugins/openapi`, `fumapress/plugins/asyncapi`, `@fumapress/graphql`, `@fumapress/notion`, `@fumapress/sanity` and `@fumapress/obsidian`. Use the default export of `fumadocs-openapi/press`, `@fumadocs/asyncapi/press`, `@fumadocs/graphql/press`, `@fumadocs/notion/press`, `@fumadocs/sanity/press` and `fumadocs-obsidian/press`.
- Removed `fumapress/plugins/blog` and `fumapress/layouts/blog*`, use `@fumapress/blog`. `fumapress/css/preset.css` leaves out the blog styles, import `@fumapress/blog/css/preset.css` with it.
- Removed `fumapress/adapters/mdx/schema`. `pageSchema` and `metaSchema` are in `fumapress/schema`, `blogPageSchema` in `@fumapress/blog/schema`.
- Removed `fumapress/i18n`, the translations of plugins are added for you.

### Changed images

- `vercelImage()`, `cloudflareImage()` and `selfHostedImage()` replace `imagePlugin()` of `fumapress/plugins/image/*`. The preset picks the platform's.
- `selfHostedImage()` needs a server and `site.baseUrl`, without them images stay as they are. `vercelImage()` and `cloudflareImage()` work with static output.
- `ogImage` of route configs replaces `takumiOptions`, and `takumiPlugin()` takes `path` and `getImage` instead of `basePath` and `generate`.
- On Cloudflare Workers, Open Graph images use the WebAssembly build of Takumi without passing it yourself.

### Fixes

- A `basePath` works on Cloudflare, which needs Wrangler 4.148 or later, and on Netlify. Its root opened without a trailing slash hydrates on every host.
- `llms.txt` and the Markdown of pages link full page URLs, with the base path.
- The browser fetches the page tree once, instead of receiving it with every page. Change its lists in `pageTree.transformers` of the loader, not in `ui.renderPage`.
- On a Node.js server, `.md` files are served as `text/markdown` and `Accept: text/markdown` also serves the Markdown of prerendered pages.
- Markdown negotiation works on URLs with a trailing slash.
- The robots.txt sitemap link follows a custom sitemap `path`, and sitemaps escape `&` in alternate links.
- Without a home page, the navbar title goes to the first page of the language, and so does `/` with i18n.
- When pages render on demand, a language root like `/cn` renders its page instead of a 404.

### Fixed client state between pages

- Client state of a page, like selected code tabs, no longer carries over to the next page. Tabs of the next page could show no content.

### Secured requests

- Other spellings of a URL path, like `//docs`, `/%64ocs`, `/docs/` or `/docs/index.html`, redirect to the normal path, so middleware sees the path the router matches.
- Middleware sees the page URL on every client navigation, whatever the request method.
- The self-hosted image optimizer fetches relative images from `site.baseUrl`, never from the `Host` of a request, and limits its memory.
- The route of `llmsPlugin({ routes: "all" })` that renders Markdown is unreachable from outside.
- A fully dynamic source no longer writes its page tree to the public directory.
