---
packages:
  "npm:fumapress": minor
---

### Refactored the Waku runtime onto `createPress()`

- Refactored: `press.config` exports `createPress(content, { i18n, loaderOptions }).plugins(...).config({...})`, replacing `defineConfig()`, `.adapters()` and `.layouts()`.
- `ui.renderPage(props)` renders every page, content pages and plugin views, typed by `props.type`; `props.renderDefault()` is the built-in Docs Layout or Home Layout.
- `ui.renderRoot({ lang, head, children })` replaces `renderRoot`, with the styles in `head` and the root provider in `children`.
- `ui.providerProps` sets the root provider of every page, like `theme`, over the `providerProps()` of plugins.
- Deprecated `meta`, use the keyed `head` tags instead.
- The MDX renderer is built in: `press({ components: "./src/components/mdx.tsx" })` of `fumapress/vite` sets the MDX components, relative links resolve by default.
- MDX renders with `mdxPlugin()` of `fumadocs-mdx/plugin`, which needs `fumadocs-mdx` 15.4.11 or later. A custom server entry passes it: `createRouter(press, { renderers: [mdxPlugin({ components })] })`.
- Plugins are `Plugin` of `fumapress`, replacing `PressPlugin`. They reach Waku through `waku`: `createPages` (layouts in route groups only), `honoMiddleware` and `unstable_serverEntry`, replacing `createPages`, `createMiddlewares` and `unstable_onServerEntry`. The first plugin is the outermost server entry wrapper.
- The `middleware()` of plugins runs on client navigations too, with the request of the page.
- Image optimizers are plugins: `vercelImage()`, `cloudflareImage()` and `selfHostedImage()`, replacing the `image` option of `fumapress/vite`. The preset's `waku:image` entry picks the platform's.
- The 404 page is your own `src/pages/404.tsx`, else a plugin view at `/404` (of the default language in languages without one), else the built-in page in the Home Layout.
- Without a search plugin, the search toggle is hidden unless `ui.providerProps.search.SearchDialog` sets your dialog.
- `WakuRouteProps<typeof app>`, `WakuRouteConfig` and `getPressContext<typeof app>()` type your own pages; `usePressSearch()` of `fumapress/search` gives the search of the site's search plugin.
- Refactored: removed the layout factories of `fumapress/layouts/*`, `fumapress/adapters/mdx`, `fumapress/plugins/blog` and `fumapress/i18n` (use `@fumapress/blog`), `renderNotFound`, `AppContext`, `this.data`, `preinit`, `configureRoutes` and plugin `renderPage`.
- `fumapress/css/preset.css` no longer includes the blog styles, import `@fumapress/blog/css/preset.css` with `@fumapress/blog`.
