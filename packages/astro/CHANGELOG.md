## @fumapress/astro@0.1.0

### Fumapress on Astro

- `@fumapress/astro` runs the site of `press.config.tsx` on Astro, with the plugins, `ui` options and search of Fumapress.
- Add its default export to the `integrations` of Astro, and write the site with `createPress()` of `@fumapress/astro/config`. The core plugins are at `@fumapress/astro/plugins/*`.
- It follows the `output`, adapter, `site` and `base` of Astro. A route rendered on demand without an adapter fails the build, naming the route.
- `ui.renderPage` can return an `.astro` file as the layout of a page, with a React root from `createIsland()` of `@fumapress/astro/client` in `client:*`. `LayoutProps<typeof app, "docs">` and `IslandProps<typeof app, "docs">` of `@fumapress/astro/config` type them.
- `@fumapress/astro/css/default.css` is the whole stylesheet, `@fumapress/astro/css/preset.css` only the styles of Fumapress for a custom Tailwind and Fumadocs UI setup.
- It needs Astro 7.4 and Node.js 22.23.4 or later.
