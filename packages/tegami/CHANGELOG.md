## @fumapress/tegami@1.1.3

### Swap `cnfast` for `cn`

Class name merging now runs on [`cn`](https://github.com/shadcn-ui/cn) instead of `cnfast`. Both are drop-in replacements for `clsx` + `tailwind-merge`, so merge behavior and the classes you get out are unchanged.

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
