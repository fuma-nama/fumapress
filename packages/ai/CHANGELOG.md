## @fumapress/ai@1.2.1

### Keep the path of `site.baseUrl` in absolute URLs

Absolute URLs are now joined to `site.baseUrl` instead of resolved against it, so sites served from a sub-path (e.g. GitHub Pages project sites) keep it in `og:image`, canonical, `og:url`, `hreflang` links, sitemap entries, the robots `Sitemap` entry and RSS links. Before, `https://user.github.io/repo` produced `https://user.github.io/index.webp` instead of `https://user.github.io/repo/index.webp`.

The RSS `<link rel="alternate">` now includes `basePath` too.

## @fumapress/ai@1.2.0

### Chat UI from `@fumadocs/ai-chat`

The chat UI is replaced with [`@fumadocs/ai-chat`](https://www.npmjs.com/package/@fumadocs/ai-chat): questions rest at the top while answers stream below, Markdown is rendered block by block, and search calls expand to the pages they found. Questions send the page title along with its URL, so the model can answer the "Summarize this page" suggestion.

The chat is passed to the `aiChat` option of layouts, docked beside the page on wide viewports and floating over it on smaller ones, in the docs, notebook, glass, and the new spacious layouts. Glass and spacious layouts show the Ask AI trigger in their own header, docs and notebook layouts keep the floating trigger. It requires Fumadocs UI v16.16.0 or above, `@fumapress/ai/css/preset.css` includes the styles of the chat.

### `@fumapress/ai/components/search` is removed

Use `@fumapress/ai/components/chat` instead: `AIChat` connects the `@fumadocs/ai-chat` components to the `/api/ai` endpoint, and it re-exports `AIChatPanel`, `AIChatTrigger`, and `useAIChat()`.

The translation keys of `aiTranslations()` are the ones of `@fumadocs/ai-chat`, update your translations of the chat.

### MCP server on MCP SDK v2

`mcpPlugin()` serves requests with `createMcpHandler()` of `@modelcontextprotocol/server` v2, instead of `@modelcontextprotocol/sdk` v1. It's stateless: sessions are no longer kept in memory, so the server works across serverless instances.

- `list_pages` and `get_page` are registered with `registerSourceTools()` from `fumadocs-core/mcp`, `get_page` takes the page `url` instead of `path`.
- `list_pages` returned a pending promise instead of the index since Fumadocs v16.15.9, it returns the `llms.txt` index again.
- The `server` given to the `tools` option is an `McpServer` of `@modelcontextprotocol/server`.

## @fumapress/ai@1.1.3

### Swap `cnfast` for `cn`

Class name merging now runs on [`cn`](https://github.com/shadcn-ui/cn) instead of `cnfast`. Both are drop-in replacements for `clsx` + `tailwind-merge`, so merge behavior and the classes you get out are unchanged.

### Honor `hideLocale` in routing

`hideLocale: "default-locale"` in your i18n config now serves the default language without URL prefix, so routes match `page.url`: content pages, `src/pages`, blog routes, Open Graph images and `.md` versions all follow. Build language-aware links in plugins and layouts with `this.localizePath(lang, pathname)`.

### Root pages of i18n sites

Static i18n builds emit `index.html` (a redirect to the default language, or its index page when the prefix is hidden) and a root `404.html`. Pages with `autoI18n: false` render inside the root layout of the default language instead of a bare document.

### Locale switch with hidden prefix

Switching back to the default language no longer navigates to a prefixed URL that does not exist.

### Integrations follow the prefix policy

`localeRoutes()` and `withLang()` are available from `fumapress/internal`, so plugins outside the core can register one route per language too. That entry point is not covered by semver. The Tegami changelog routes, the Mintlify 404 redirect and the `get_page` tool of the MCP server follow the policy now, instead of assuming every language has a URL prefix.

## @fumapress/ai@1.1.2

### Loosen `fumapress` dependency ranges

Peer dependencies on `fumapress` (and `@fumapress/*`) now publish as `^x.y.z` instead of an exact version pin, so these packages stay compatible with newer core releases without needing a re-release.

## @fumapress/ai@1.0.0

### Redesign the core API for v1

Layouts move onto the config object (`renderPage`, `renderRoot`, `renderNotFound`, `defaultLayoutProps`), `content` replaces `loader`, and plugin types are renamed (`PressPlugin`, `AppShape`).

See the [migration guide](https://press.fumadocs.dev/docs/migrate).

### Fix `aiPlugin` export

`aiPlugin` was re-exported as a type-only export, so `import { aiPlugin } from "@fumapress/ai"` failed at runtime. It is now exported as a value.

### Support the Glass layout

`aiPlugin` now binds AI chat to the Glass layout's native `aiChat` option, the Ask AI trigger is shown in the layout header & sidebar instead of a floating button.

## @fumapress/ai@1.0.0-beta.2 (beta)

### Fix `aiPlugin` export

`aiPlugin` was re-exported as a type-only export, so `import { aiPlugin } from "@fumapress/ai"` failed at runtime. It is now exported as a value.

### Support the Glass layout

`aiPlugin` now binds AI chat to the Glass layout's native `aiChat` option, the Ask AI trigger is shown in the layout header & sidebar instead of a floating button.

## @fumapress/ai@1.0.0-beta.0 (beta)

### Redesign the core API for v1

Layouts move onto the config object (`renderPage`, `renderRoot`, `renderNotFound`, `defaultLayoutProps`), `content` replaces `loader`, and plugin types are renamed (`PressPlugin`, `AppShape`).

See the [migration guide](https://press.fumadocs.dev/docs/migrate).

## @fumapress/ai@0.7.0

### Default to Base UI

CLI & internal packages now use Base UI over Radix UI by default.

### Auto-detect CJS deps with export maps

The Vite plugin now pre-bundles CJS dependencies that ship an `exports` field (e.g. `use-sync-external-store` pulled in by Base UI), including their deep imports. The manual `optimizeDeps.include` workaround and the direct `use-sync-external-store` dependency are no longer needed.

### Use cnfast for class merging

Class name helpers now use `cnfast` instead of `tailwind-merge` directly for compatible Tailwind class merging with faster runtime performance.

## @fumapress/ai@0.6.3

### Bump deps

Use Waku beta 6 and AI SDK 7.

# @fumapress/ai

## 0.6.2

### Patch Changes

- Updated dependencies [ca207d9]
- Updated dependencies [5d7e41d]
  - fumapress@0.6.2

## 0.6.1

### Patch Changes

- Updated dependencies [944bd1c]
  - fumapress@0.6.1

## 0.6.0

### Patch Changes

- Updated dependencies [16d246d]
  - fumapress@0.6.0

## 0.5.5

### Patch Changes

- 892ff9f: Fix handling of `basePath` in plugins
- Updated dependencies [892ff9f]
  - fumapress@0.5.5

## 0.5.4

### Patch Changes

- cae103b: Support MCP server
- Updated dependencies [fe349d3]
  - fumapress@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies [719a1da]
- Updated dependencies [ea0439d]
- Updated dependencies [67609a3]
- Updated dependencies [5f93010]
  - fumapress@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies [a7e1829]
- Updated dependencies [4a73ee5]
  - fumapress@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [793f82d]
- Updated dependencies [6c089fd]
- Updated dependencies [9ea0ee6]
  - fumapress@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [426e392]
- Updated dependencies [0fe67b0]
- Updated dependencies [c8a2fbd]
- Updated dependencies [be15a6f]
- Updated dependencies [60b23a7]
  - fumapress@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [7f4f577]
- Updated dependencies [c35796d]
- Updated dependencies [3eb4adc]
- Updated dependencies [2e7bc34]
- Updated dependencies [e145b15]
  - fumapress@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [86467b7]
- Updated dependencies [b6e011e]
- Updated dependencies [043dd3e]
  - fumapress@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [60fd1c3]
- Updated dependencies [145f92b]
- Updated dependencies [b1a00a0]
  - fumapress@0.3.0

## 0.2.5

### Patch Changes

- 266b3f5: Support children transformer
- Updated dependencies [266b3f5]
  - fumapress@0.2.5

## 0.2.4

### Patch Changes

- d19df8b: fix build
- Updated dependencies [d19df8b]
  - fumapress@0.2.4

## 0.2.3

### Patch Changes

- f79e5e1: Typed i18n config
- a84430c: Support chained functions for config
- 6878adf: Reduce peer dependencies & make `vite` optional.
- Updated dependencies [f79e5e1]
- Updated dependencies [a84430c]
- Updated dependencies [6878adf]
  - fumapress@0.2.3

## 0.2.2

### Patch Changes

- Updated dependencies [cd4aaa9]
- Updated dependencies [cd4aaa9]
- Updated dependencies [cd4aaa9]
- Updated dependencies [cd4aaa9]
  - fumapress@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies [3b3083e]
  - fumapress@0.2.1
