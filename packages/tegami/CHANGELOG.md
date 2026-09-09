## @fumapress/tegami@1.1.3

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

## @fumapress/tegami@1.1.2

### Loosen `fumapress` dependency ranges

Peer dependencies on `fumapress` (and `@fumapress/*`) now publish as `^x.y.z` instead of an exact version pin, so these packages stay compatible with newer core releases without needing a re-release.

## @fumapress/tegami@1.0.0

### Redesign the core API for v1

Layouts move onto the config object (`renderPage`, `renderRoot`, `renderNotFound`, `defaultLayoutProps`), `content` replaces `loader`, and plugin types are renamed (`PressPlugin`, `AppShape`).

See the [migration guide](https://press.fumadocs.dev/docs/migrate).

## @fumapress/tegami@1.0.0-beta.0 (beta)

### Redesign the core API for v1

Layouts move onto the config object (`renderPage`, `renderRoot`, `renderNotFound`, `defaultLayoutProps`), `content` replaces `loader`, and plugin types are renamed (`PressPlugin`, `AppShape`).

See the [migration guide](https://press.fumadocs.dev/docs/migrate).

## @fumapress/tegami@0.7.3

### Fix tegami files date parsing

Tegami plugin now use a separate adapter hook for date.
