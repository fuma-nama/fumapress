---
packages:
  "npm:@fumapress/astro": minor
  "npm:create-fumapress": patch
---

### Fumapress on Astro

- Added `@fumapress/astro`: the site of `press.config.tsx` on Astro, with the plugins, layouts and search of Fumapress.
- `@fumapress/astro/config` exports `createPress()` and the site types of Fumapress, like `RenderPageProps<typeof app>`, `@fumapress/astro/plugins/*` the core plugins.
- `ui.renderPage` renders every page Fumapress renders, `renderDefault()` is the built-in docs and home UI.
- A custom search dialog is `ui.providerProps.search.SearchDialog` with `usePressSearch()` of `@fumapress/astro/search`. Any search plugin works.
- `ui.providerProps` sets the root provider of every page, like `theme`.
- `@fumapress/astro/css/default.css` is the whole stylesheet, `@fumapress/astro/css/preset.css` only the styles of Fumapress, for your own Tailwind and Fumadocs UI setup.
- `getProviderData<typeof app>()` types `lang` by the site, it returns `ProviderData` of `@fumapress/astro/runtime`.
- Collection pages: `getPageBody()` returns their body, and their `date` frontmatter is their creation date.
- With `trailingSlash: "always"`, the UI of plugins requests their routes rendered on request with the slash, so feedback and Ask AI work behind adapters that redirect first, like `@astrojs/node`.
- A view of plugins at `/404` is the 404 page, unless you have your own `404.astro`.
- Development reports plugins using Waku's own APIs, which Astro doesn't run.
- `create-fumapress --framework astro` scaffolds an Astro site.
