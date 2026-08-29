## fumapress@1.2.0

### Deprecate `createLayoutSwitchAuto`

Write a `renderPage` function switching on `page.type` instead, plain code with the same result:

```tsx
renderPage: (props) => {
  if (props.page.type === "blog") return <BlogPage {...props} />;

  return <DocsPage {...props} />;
},
```

### Use the Markdown renderer from Fumadocs

The renderer behind `fumapress/markdown` moved into Fumadocs, so `asMarkdown`, `md`, and
`renderToMarkdown` are now re-exports of `fumadocs-core/server`. The output is unchanged.

The `fumadocs-core` peer dependency now requires `16.15.3` or above.

### Treat `data:` images as unoptimized

Vite inlines a small image as a `data:` URL at build time. `Image` sent this URL to the image
optimizer. An optimizer cannot fetch a `data:` URL, so Vercel returned `400 INVALID_IMAGE_OPTIMIZE_REQUEST`
and the image did not show. `Image` now treats a `data:` src as unoptimized and renders a plain `<img>`.

### Video & news entries in sitemaps

`SitemapUrl` declared `videos` and `news` fields that were never serialized, setting them
type-checked but the values were silently dropped. They are now written to the sitemap, with the
`video` and `news` namespaces declared on the `urlset`.

`buildSitemap(entries)` is now exported, like `buildRSS`, for serving custom sitemaps from your own
routes.

## fumapress@1.1.2

### Accept string dates in `core:get-creation-date`

Fumadocs MDX serializes frontmatter as JSON, so a `date` field reaches the adapter as a string.
The hook only accepted `Date` objects and returned `undefined` otherwise, which made blog posts fall
back to the build time. It now parses strings, like `tegami:get-date` already did.

## fumapress@1.1.1

### Bump deps

Use Waku RC 1.

### Require `"type": "module"` in package.json

Without it, Vite emits `.mjs` server bundles and static generation fails with a cryptic
`Cannot find module 'dist/server/build.js'`. The CLI now stops early and tells you to add it.

## fumapress@1.1.0

### Markdown for every route (`fumapress/markdown`)

Server components can now define their own Markdown form:

```tsx
import { asMarkdown, md } from "fumapress/markdown";

function Callout({ title, children }) {
  if (asMarkdown()) return md.linePrefix("> ")`**${title}**\n${children}`;

  return <div className="callout">...</div>;
}
```

Calling `asMarkdown()` is the opt-in: `md` renders interpolated React nodes, with
`md.linePrefix(prefix)` and `md.indent(size)` for nested blocks. Components that never call it are
kept as JSX syntax (`<Card title="...">...</Card>`), and so are client components, wrap those in a
server component to give them a Markdown form. `renderToMarkdown(node)` renders a tree yourself.

With `llmsPlugin({ routes: "all" })`, every page created with `createPage()` (`src/pages/index.tsx`,
blog pages, custom routes) whose component calls `asMarkdown()` gets a `.md` version: static pages
are pre-rendered, dynamic pages are rendered on request. Plugins can observe the pages of other
plugins with the new `prepareCreatePages()` hook, which runs before any page is created.

### Remove the `resolvePage()` plugin hook

Nothing implements it since the blog plugin moved to `renderPage()`, pages now always come from the
content source as-is.

## fumapress@1.0.0

### Automatic image optimization

The recommended preset now enables image optimization automatically, with a provider matching your
deployment adapter (auto-detected from the environment, or set via the `adapter` option):

- **Vercel**: Vercel Image Optimization.
- **Cloudflare**: Cloudflare Image Transformations.
- **Node.js**: the self-hosted Sharp endpoint, only when `sharp` is installed in your app and the
  render mode is not static.

On other targets, or when the requirements above aren't met, image optimization is skipped and the
`Image` component keeps rendering a plain `<img>`, so `sharp` stays an optional dependency.

An explicitly configured image plugin takes priority over the detected provider. Configure one to
customize options such as `allowedHosts` for remote images.

### Own CLI, Waku.js becomes an internal dependency

Fumapress now ships its own `fumapress` CLI and manages Waku.js as a regular dependency, so apps no
longer install `waku` or `react-server-dom-webpack` themselves. Fresh installs only need `fumapress`,
Fumadocs, React, and Vite.

**Migration:**

- Remove `waku` and `react-server-dom-webpack` from your dependencies.
- Add `vite` to your `devDependencies` if it isn't there yet.
- Replace `waku dev`/`waku build`/`waku start` scripts with `fumapress dev`/`fumapress build`/`fumapress start`.
- Rename `waku.config.ts` to `vite.config.ts`: it is a plain Vite config now, use `defineConfig` from
  `vite` and move the `vite` field's contents to the top level.
- Waku-specific options (`basePath`, `srcDir`, `distDir`, `privateDir`, `rscBase`, and the deployment
  adapter) moved into the `press()` plugin options in `vite.config.ts`.
- Delete `src/pages.gen.ts` if present, it is stale output of Waku's route typegen (disabled by
  Fumapress) and its `waku/router` type imports no longer resolve.

Custom server entries (`src/waku.server.tsx`) keep using Waku APIs directly — install `waku` yourself
in that case, matching the version pinned by Fumapress.

### Auto-dedupe framework packages

The `press()` Vite plugin now adds detected framework packages (Fumadocs, Fumapress plugins, and other
packages with a React peer dependency) to `resolve.dedupe`, preventing duplicated React contexts when
a package manager instantiates them more than once. The manual `resolve.dedupe: ["fumadocs-ui"]`
workaround is no longer necessary.

### Skip error when base URL is not specified

### Support robots.txt plugin

Auto-generate `robots.txt`.

### Support RSS plugin

Auto-generate RSS feed from plugin.

### Support "recommended" plugin preset

By default, the "recommended" plugin preset will be enforced, adding plugins for llms.txt, robots.txt, rss, and search.

### Redesign the core API for v1

Layouts move onto the config object (`renderPage`, `renderRoot`, `renderNotFound`, `defaultLayoutProps`), `content` replaces `loader`, and plugin types are renamed (`PressPlugin`, `AppShape`).

See the [migration guide](https://press.fumadocs.dev/docs/migrate).

### Support GitLab and Bitbucket repositories

`site.git` accepts a `provider` option (`github` by default, plus `gitlab` and `bitbucket`). The navbar icon link and page source links now point at the configured provider with its own brand icon. Self-hosted instances can set `git.url` to their instance URL.

`ctx.getFileGitHubUrl()` is renamed to `ctx.getFileUrl()`, the old name still works but is deprecated.

### Use Waku beta 8

Bump dependencies.

### Migrate built-in search to ZBSearch

Static Orama search now uses Fumadocs Core's `staticClient` backed by ZBSearch. The `@orama/orama` dependency was removed.

### Use `fumadocsMdx()` Vite plugin

Scaffolded apps and docs examples now register the Fumadocs MDX Vite plugin via `fumadocsMdx()` instead of the default import.

### Support the Glass layout

Added `fumapress/layouts/glass`, a layout wrapper for the new Glass layout from Fumadocs UI. It accepts the same options as the docs & notebook layouts, and works with built-in plugins (OpenAPI, AsyncAPI, GraphQL, llms.txt).

```tsx title="press.config.tsx"
import { createGlassLayoutPage } from "fumapress/layouts/glass";

const GlassLayout = createGlassLayoutPage<typeof config.$context>();
```

It requires Fumadocs UI v16.12.0 or above, remember to import `fumadocs-ui/css/generated/glass.css` in your CSS file.

### Report broken links as data

`linkValidationPlugin` gained a `report` option. It still fails the build by default, but can now
write `dist/fumapress-diagnostics.json` instead, so a CI check can annotate a pull request rather
than parse an error message.

```tsx
linkValidationPlugin({ report: "json" });
```

Use `"both"` to write the file and still fail the build. The file is written on every build, so an
empty `diagnostics` array means validation ran and found nothing, rather than that it never ran.

### Fix tag links on the blog tags page

The tags page hardcoded `/blog/tags/{tag}` for every tag, so a `blogPlugin` configured with a custom
`paths.tags` linked to a route that was never generated, and localized sites dropped the locale
prefix. Both cases returned 404. Links now resolve against the configured tags path and the current
locale, matching the tag links already rendered on blog posts.

## fumapress@1.0.0-beta.3 (beta)

### Report broken links as data

`linkValidationPlugin` gained a `report` option. It still fails the build by default, but can now
write `dist/fumapress-diagnostics.json` instead, so a CI check can annotate a pull request rather
than parse an error message.

```tsx
linkValidationPlugin({ report: "json" });
```

Use `"both"` to write the file and still fail the build. The file is written on every build, so an
empty `diagnostics` array means validation ran and found nothing, rather than that it never ran.

### Fix tag links on the blog tags page

The tags page hardcoded `/blog/tags/{tag}` for every tag, so a `blogPlugin` configured with a custom
`paths.tags` linked to a route that was never generated, and localized sites dropped the locale
prefix. Both cases returned 404. Links now resolve against the configured tags path and the current
locale, matching the tag links already rendered on blog posts.

## fumapress@1.0.0-beta.2 (beta)

### Support the Glass layout

Added `fumapress/layouts/glass`, a layout wrapper for the new Glass layout from Fumadocs UI. It accepts the same options as the docs & notebook layouts, and works with built-in plugins (OpenAPI, AsyncAPI, GraphQL, llms.txt).

```tsx title="press.config.tsx"
import { createGlassLayoutPage } from "fumapress/layouts/glass";

const GlassLayout = createGlassLayoutPage<typeof config.$context>();
```

It requires Fumadocs UI v16.12.0 or above, remember to import `fumadocs-ui/css/generated/glass.css` in your CSS file.

## fumapress@1.0.0-beta.1 (beta)

### Migrate built-in search to ZBSearch

Static Orama search now uses Fumadocs Core's `staticClient` backed by ZBSearch. The `@orama/orama` dependency was removed.

### Use `fumadocsMdx()` Vite plugin

Scaffolded apps and docs examples now register the Fumadocs MDX Vite plugin via `fumadocsMdx()` instead of the default import.

## fumapress@1.0.0-beta.0 (beta)

### Support robots.txt plugin

Auto-generate `robots.txt`.

### Support RSS plugin

Auto-generate RSS feed from plugin.

### Support "recommended" plugin preset

By default, the "recommended" plugin preset will be enforced, adding plugins for llms.txt, robots.txt, rss, and search.

### Redesign the core API for v1

Layouts move onto the config object (`renderPage`, `renderRoot`, `renderNotFound`, `defaultLayoutProps`), `content` replaces `loader`, and plugin types are renamed (`PressPlugin`, `AppShape`).

See the [migration guide](https://press.fumadocs.dev/docs/migrate).

### Support GitLab and Bitbucket repositories

`site.git` accepts a `provider` option (`github` by default, plus `gitlab` and `bitbucket`). The navbar icon link and page source links now point at the configured provider with its own brand icon. Self-hosted instances can set `git.url` to their instance URL.

`ctx.getFileGitHubUrl()` is renamed to `ctx.getFileUrl()`, the old name still works but is deprecated.

### Use Waku beta 8

Bump dependencies.

## fumapress@0.7.3

### Support `renderBody` option

Override renderer/props for `<DocsBody />` component.

### Fix tegami files date parsing

Tegami plugin now use a separate adapter hook for date.

## fumapress@0.7.2

### Use Takumi v2

The Takumi plugin now use Takumi v2 instead of the old v1 usage.

## fumapress@0.7.1

### Fix base URL for `<Image />`

The image component will no longer append base URL by default.

## fumapress@0.7.0

### Default to Base UI

CLI & internal packages now use Base UI over Radix UI by default.

### Auto-detect CJS deps with export maps

The Vite plugin now pre-bundles CJS dependencies that ship an `exports` field (e.g. `use-sync-external-store` pulled in by Base UI), including their deep imports. The manual `optimizeDeps.include` workaround and the direct `use-sync-external-store` dependency are no longer needed.

### Use cnfast for class merging

Class name helpers now use `cnfast` instead of `tailwind-merge` directly for compatible Tailwind class merging with faster runtime performance.

## fumapress@0.6.3

### Bump deps

Use Waku beta 6 and AI SDK 7.

### Fix notebook Markdown URL with llms.txt plugin

Notebook doesn't show Markdown URL with llms.txt plugin.

# fumapress

## 0.6.2

### Patch Changes

- ca207d9: Fix i18n: the blog index, blog tags-list, and localized 404 pages were registered under numeric locale paths (`/0`, `/1`, …) instead of locale codes, because their `staticPaths` used `Object.keys(i18nConfig.languages)` on the `languages` array (which yields its indices). Use the `languages` array directly.
- 5d7e41d: Support AsyncAPI integration

## 0.6.1

### Patch Changes

- 944bd1c: hotfix Vite RSC resolution issues in monorepo

## 0.6.0

### Minor Changes

- 16d246d: Support OpenAPI v11

## 0.5.5

### Patch Changes

- 892ff9f: Fix handling of `basePath` in plugins

## 0.5.4

### Patch Changes

- fe349d3: fix peer deps

## 0.5.3

### Patch Changes

- 719a1da: pass Hono `app` into middlewares
- ea0439d: create proxy server when proxy url is defined
- 67609a3: Support Cloudflare CDN provider
- 5f93010: use waku beta 2

## 0.5.2

### Patch Changes

- a7e1829: Support link validation
- 4a73ee5: Support sitemap plugin

## 0.5.1

### Patch Changes

- 793f82d: Support built-in content loader API with revalidation
- 6c089fd: Support config alias
- 9ea0ee6: Support Image Optimization

## 0.5.0

### Minor Changes

- 426e392: Support 16.9 Translations API & official language pack
- c8a2fbd: Introduce server contexts over passing `ctx` into components
- 60b23a7: Support file-system based router

### Patch Changes

- 0fe67b0: Support `Accept` header in `llms.txt` plugin
- be15a6f: Support creating middlewares from plugins

## 0.4.0

### Minor Changes

- 2e7bc34: Breaking: require `server` for OpenAPI plugin

### Patch Changes

- 7f4f577: Improve plugin system
- c35796d: Support `resolvePage` hook in plugins
- 3eb4adc: Support proxy server in OpenAPI plugin
- e145b15: fix `defaultProps` being ignored

## 0.3.1

### Patch Changes

- 86467b7: rename `router.extend` to `router.createPages()`
- b6e011e: fix mdx components option
- 043dd3e: Add `page` to page renderers

## 0.3.0

### Minor Changes

- 60fd1c3: rename layouts

### Patch Changes

- 145f92b: Support `defaultProps` in layouts config
- b1a00a0: Support blog layout

## 0.2.5

### Patch Changes

- 266b3f5: Support children transformer

## 0.2.4

### Patch Changes

- d19df8b: fix build

## 0.2.3

### Patch Changes

- f79e5e1: Typed i18n config
- a84430c: Support chained functions for config
- 6878adf: Reduce peer dependencies & make `vite` optional.

## 0.2.2

### Patch Changes

- cd4aaa9: Allow strict typed adapter & plugin APIs
- cd4aaa9: Allow layout `render()` option without `body` output
- cd4aaa9: Support `providerProps` option in `createRootLayout()`
- cd4aaa9: Support `getMdxComponents()` option in Fumadocs MDX adapter

## 0.2.1

### Patch Changes

- 3b3083e: Support meta config
- Updated dependencies [298ac97]
- Updated dependencies [b212481]
  - fumadocs-mdx@15.0.2
