# Rendering

Rendering is per route, with no site-wide mode. A route reading content follows `getContentRender()`, and a route derived from a route follows that route.

# Astro runtime

`packages/astro` (`@fumapress/astro`) runs the site of `press.config.tsx` on Astro, on top of the low-level `@fumadocs/astro` integration.

- Bind the concepts of `@fumapress/core` (routes, middleware, head, slots, `build`) to Astro. Never add Astro hooks to plugins: they receive the core `Context`, and a feature that needs a new hook belongs in core.
- Overrides go through existing concepts: components by name in the MDX components module, `ui.renderPage` returning an `.astro` layout with a `createIsland()` root, `ui.providerProps` of the site, the search plugin, and users' own Astro routes. Rejected before, don't reintroduce: per-plugin layout exports, page or layout modules, a `searchEngine` field, `oauth`/`proxy` plugin options, plugins with their own blog or changelog UI.
- Every page Fumapress renders is one press island (`src/island`) unless `ui.renderPage` returns an `.astro` layout: the result of `ui.renderPage` (or the built-in UI of `renderDefault`) in the root provider. An `.astro` layout renders instead of it, with its `createIsland()` root as the press island and the page content in an island of its slot. Client components (`'use client'`) and MDX components hydrate, other components render on the server. Props of hydrating components must be serializable: devalue values, elements and client components. A client component with a function prop throws, an MDX component with one renders on the server. The page tree of a language goes by identity to its file, collection bodies are Astro slots.
- Modules reachable from compiled MDX (the components modules, `ui/content.tsx`, `ui/link.tsx`) never import the runtime or the layout module. Compiled MDX in a cycle with the source makes Astro's build superlinear.
- Injected routes and the middleware are real files in `dist`. Modules imported only by `.astro` files or generated code are tsdown entries, otherwise unbundling drops their exports.
- Search plugins (`provides: ["search"]`) give the root provider their dialog in `providerProps({ lang })`: `search: { SearchDialog, options }`, a `'use client'` export on the provider hook of `fumadocs-core/search/client` (`from` for a static index, `api` otherwise, `locale` of the page), shared with Waku. A custom dialog is `ui.providerProps.search.SearchDialog` on the same hook and receives the plugin's `options`, never a `SearchClient`.
- The `build` of plugins runs on the pages of Astro's default prerenderer, in the build process. Other prerenderers fail with the reason.
- Check changes across setups: `base` with `trailingSlash` and `build.format`, static output, an adapter and `output: 'server'`, a dynamic source, i18n with every `hideLocale`, a custom `ui.renderPage`, custom search, own pages with `HomeLayout.astro`.
- Astro needs Node >= 22.23.4.

# Release workflow

This repository uses [Tegami](https://tegami.fuma-nama.dev) for versioning and publishing.

## Write changelog files

Create pending changelog files under `.tegami/` as `YYYY-MM-DD-{hash}.md`.

See the [changelog format docs](https://tegami.fuma-nama.dev/changelog) for details.

### Example

```md
---
packages:
  "npm:@acme/ui": patch
---

### Fix button hover state

The hover color now matches the design system.
```

### Package references

Use package names, ids, or groups in frontmatter. For example:

- `"@acme/ui"` — package name
- `"npm:@acme/ui"` — package id
- `"group:acme"` — every package in a group

Rules:

- Include YAML frontmatter with `packages`
- Include at least one `#`, `##`, or `###` heading in the body
- Write user-facing release notes under each heading
- Do not edit `.tegami/publish-plan` or package `CHANGELOG.md` files directly
