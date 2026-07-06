---
packages:
  "npm:@fumapress/mintlify": minor
---

## Port the full Mintlify docs.json feature surface

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
