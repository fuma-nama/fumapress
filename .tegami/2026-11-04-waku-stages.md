---
packages:
  "npm:fumapress": minor
---

### Refactored the Waku runtime onto `createPress()`

- Refactored: `press.config` exports `createPress(content, { i18n, loaderOptions }).plugins(...).config({...})`, replacing `defineConfig()`, `.adapters()` and `.layouts()`.
- `ui.renderPage(props)` renders every page, content pages and plugin views, typed by `props.type`; `props.renderDefault()` is the built-in Docs Layout or Home Layout.
- `ui.renderRoot({ lang, head, children })` replaces `renderRoot`, with the styles in `head` and the root provider in `children`.
- `ui.providerProps` sets the root provider of every page, like `theme`, over the `providerProps()` of plugins.
- Refactored: removed `meta`, use the keyed `head` tags.
- The MDX renderer is built in: `press({ components: "./src/components/mdx.tsx" })` of `fumapress/vite` sets the MDX components, relative links resolve by default.
- MDX renders with `mdxPlugin()` of `fumadocs-mdx/press`, which needs `fumadocs-mdx` 15.5.0 or later. A custom server entry passes it: `createRouter(press, { renderers: [mdxPlugin({ components })] })`.
- Plugins are `Plugin` of `fumapress`, replacing `PressPlugin`. They reach Waku through `waku` (`WakuPlugin`): `createPages` (layouts in route groups only), `honoMiddleware` and `unstable_serverEntry`, replacing `createPages`, `createMiddlewares` and `unstable_onServerEntry`. The first plugin is the outermost server entry wrapper.
- The `middleware()` of plugins runs on client navigations too, with the request of the page.
- Image optimizers are plugins: `vercelImage()`, `cloudflareImage()` and `selfHostedImage()`, replacing the `image` option of `fumapress/vite`. The preset's `image` entry picks the platform's.
- The 404 page is your own `src/pages/404.tsx`, else a plugin view at `/404` (of the default language in languages without one), else the built-in page in the Home Layout.
- Without a search plugin, the search toggle is hidden unless `ui.providerProps.search.SearchDialog` sets your dialog.
- `WakuRouteProps<typeof app, "/showcase/[slug]">`, `WakuRouteConfig` and `getPressContext<typeof app>()` type your own pages and their params.
- A custom search dialog is `ui.providerProps.search.SearchDialog`, a client component on a Fumadocs search hook like `useFlexsearchStatic()`. It receives the search plugin's `from` or `api` and `locale`.
- Refactored the Open Graph images: `ogImage` of route configs replaces `takumiOptions`, and `takumiPlugin()` takes `path` and `getImage` instead of `basePath` and `generate`.
- Refactored: removed `fumapress/plugins/openapi` and `fumapress/plugins/asyncapi`, use `openapiPlugin()` of `fumadocs-openapi/press` and `asyncapiPlugin()` of `@fumadocs/asyncapi/press`.
- Refactored: removed `fumapress/adapters/mdx/schema`, use `fumapress/schema`.
- Refactored: removed `@fumapress/graphql`, `@fumapress/notion`, `@fumapress/sanity` and `@fumapress/obsidian`, use the default export of `/press` of the Fumadocs integration.
- Refactored: removed the layout factories of `fumapress/layouts/*`, `fumapress/adapters/mdx`, `fumapress/plugins/blog` and `fumapress/i18n` (use `@fumapress/blog`), `renderNotFound`, `AppContext`, `this.data`, `preinit`, `configureRoutes` and plugin `renderPage`.
- `selectTreeRoot(tree, "docs")` replaces the `treeRoot` option of the layouts: pass it to the `tree` of your layout in `ui.renderPage`.
- `fumapress/css/preset.css` no longer includes the blog styles, import `@fumapress/blog/css/preset.css` with `@fumapress/blog`.
- Without a home page, the navbar title goes to the first page of the language, and so does `/` with i18n.
- 2000-page builds work, and client navigation sends only the page.
- Lists of the tree in `ui.renderPage` are read-only: change them in `pageTree.transformers` of the loader.
- Sites with a Worker start on Cloudflare with the generated Wrangler config, also with `@cloudflare/vite-plugin`, and render Open Graph images on request, including pages added after the build.
- A `basePath` works on Cloudflare, which needs Wrangler 4.148 or later, and on Netlify. Its root opened without a trailing slash hydrates on every host.
- `.md` files from `fumapress start` are served as `text/markdown`, and `Accept: text/markdown` also serves the Markdown of prerendered pages.
- `staticPaths` works on static API routes in `src/pages/_api`.
- With `mode: "dynamic"`, a language root like `/cn` renders its page instead of a 404.
