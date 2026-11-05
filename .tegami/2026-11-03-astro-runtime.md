---
packages:
  "npm:@fumapress/astro": minor
  "npm:create-fumapress": patch
---

### Fumapress on Astro

- Added `@fumapress/astro`: the site of `press.config.tsx` on Astro, with the plugins, layouts and search of Fumapress.
- `@fumapress/astro/config` exports `createPress()` and the site types of Fumapress, like `RenderPageProps<typeof app>`, `@fumapress/astro/plugins/*` the core plugins.
- `@fumapress/astro/css/default.css` is the whole stylesheet, `@fumapress/astro/css/preset.css` only the styles of Fumapress, for your own Tailwind and Fumadocs UI setup.
- Relative links of collection pages, like `./other.mdx`, resolve to the URLs of their pages.
- `getProviderData<typeof app>()` types `lang` by the site, it returns `ProviderData` of `@fumapress/astro/runtime`.
- Collection pages: `getPageBody()` returns their body, and their `date` frontmatter is their creation date.
- Link validation covers every link, like the ones in sidebars, plugin views and Local Markdown pages.
- A page added in dev shows up without a restart.
- A view of plugins at `/404` is the 404 page, unless you have your own `404.astro`.
- `create-fumapress --framework astro` scaffolds an Astro site.
