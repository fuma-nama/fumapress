## @fumapress/mintlify@1.1.2

### Loosen `fumapress` dependency ranges

Peer dependencies on `fumapress` (and `@fumapress/*`) now publish as `^x.y.z` instead of an exact version pin, so these packages stay compatible with newer core releases without needing a re-release.

## @fumapress/mintlify@1.0.0

### Redesign the core API for v1

Layouts move onto the config object (`renderPage`, `renderRoot`, `renderNotFound`, `defaultLayoutProps`), `content` replaces `loader`, and plugin types are renamed (`PressPlugin`, `AppShape`).

See the [migration guide](https://press.fumadocs.dev/docs/migrate).

## @fumapress/mintlify@1.0.0-beta.0 (beta)

### Redesign the core API for v1

Layouts move onto the config object (`renderPage`, `renderRoot`, `renderNotFound`, `defaultLayoutProps`), `content` replaces `loader`, and plugin types are renamed (`PressPlugin`, `AppShape`).

See the [migration guide](https://press.fumadocs.dev/docs/migrate).

## @fumapress/mintlify@0.1.0

### Port the full Mintlify docs.json feature surface

`mintlifyPlugin()` now applies (in addition to navigation, navbar links, redirects and OpenAPI):

- `colors` (`primary` / `light`) mapped to the Fumadocs theme, with automatic foreground colors
- `logo` (single or light/dark, with `href`) and `favicon` (single or light/dark)
- `appearance` (`default` color scheme, `strict` hides the theme toggle)
- `background` color & image (light/dark variants)
- `fonts` — Google Fonts are loaded automatically, self-hosted `woff`/`woff2` supported, separate `heading`/`body` fonts
- navigation icons rendered with Lucide (Font Awesome/Tabler names matched best-effort) and `tag` badges on groups/versions
- navbar link icons, GitHub/Discord brand icons and the `primary` CTA (`button`/`github`/`discord`)
- `banner` with inline Markdown, dismiss button and `type`/`color` styling
- `footer` with social brand icons and link columns
- `redirects` path patterns (`:param`, `:param*`) with parameter substitution
- `errors.404` (redirect to home by default, or custom title/description)
- `seo.metatags` and `seo.indexing` (noindex for pages outside the navigation)
- `search.prompt`, `description` and `metadata.timestamp` (Mintlify semantics: last-updated hidden unless enabled)
- analytics `integrations`: GA4, GTM, Plausible, Fathom, PostHog, Mixpanel, Amplitude, Clarity, Heap, Hotjar, Intercom, Koala, LogRocket, Pirsch, Segment
- `api.asyncapi` sources via the new `createMintlifyAsyncAPI()` in `@fumapress/mintlify/asyncapi`

Unsupported properties are still parsed (migration never fails on a valid `docs.json`) and documented in the new Mintlify integration docs page.

### Breaking changes

- `applyNavbar` / `applyRedirects` plugin options were replaced by the `features` toggle map, e.g. `mintlifyPlugin({ features: { navbar: false } })`.
- `buildPageTreeFromNavigation()` is now async (icons are resolved on the server).
- Last-updated timestamps on docs pages are now hidden unless `metadata.timestamp` is `true`, matching Mintlify. Disable with `features: { metadata: false }`.

### Default to Base UI

CLI & internal packages now use Base UI over Radix UI by default.

### Auto-detect CJS deps with export maps

The Vite plugin now pre-bundles CJS dependencies that ship an `exports` field (e.g. `use-sync-external-store` pulled in by Base UI), including their deep imports. The manual `optimizeDeps.include` workaround and the direct `use-sync-external-store` dependency are no longer needed.

### Use cnfast for class merging

Class name helpers now use `cnfast` instead of `tailwind-merge` directly for compatible Tailwind class merging with faster runtime performance.

## @fumapress/mintlify@0.0.10

### Bump deps

Use Waku beta 6 and AI SDK 7.

# @fumapress/mintlify

## 0.0.9

### Patch Changes

- Updated dependencies [ca207d9]
- Updated dependencies [5d7e41d]
  - fumapress@0.6.2

## 0.0.8

### Patch Changes

- Updated dependencies [944bd1c]
  - fumapress@0.6.1

## 0.0.7

### Patch Changes

- Updated dependencies [16d246d]
  - fumapress@0.6.0

## 0.0.6

### Patch Changes

- Updated dependencies [892ff9f]
  - fumapress@0.5.5

## 0.0.5

### Patch Changes

- Updated dependencies [fe349d3]
  - fumapress@0.5.4

## 0.0.4

### Patch Changes

- Updated dependencies [719a1da]
- Updated dependencies [ea0439d]
- Updated dependencies [67609a3]
- Updated dependencies [5f93010]
  - fumapress@0.5.3

## 0.0.3

### Patch Changes

- Updated dependencies [a7e1829]
- Updated dependencies [4a73ee5]
  - fumapress@0.5.2

## 0.0.2

### Patch Changes

- Updated dependencies [793f82d]
- Updated dependencies [6c089fd]
- Updated dependencies [9ea0ee6]
  - fumapress@0.5.1
