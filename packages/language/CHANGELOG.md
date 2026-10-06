## @fumapress/language@1.1.3

### Translate the Spacious layout

Update `@fumadocs/language` to v0.2.10, the Chinese presets include translations for the Spacious layout, and the redesigned API playground and schema UI of Fumadocs OpenAPI.

### Translate the AI chat of `@fumadocs/ai-chat`

The Chinese presets translate the new AI chat of `@fumapress/ai`.

## @fumapress/language@1.1.2

### Loosen `fumapress` dependency ranges

Peer dependencies on `fumapress` (and `@fumapress/*`) now publish as `^x.y.z` instead of an exact version pin, so these packages stay compatible with newer core releases without needing a re-release.

## @fumapress/language@1.0.0

### Redesign the core API for v1

Layouts move onto the config object (`renderPage`, `renderRoot`, `renderNotFound`, `defaultLayoutProps`), `content` replaces `loader`, and plugin types are renamed (`PressPlugin`, `AppShape`).

See the [migration guide](https://press.fumadocs.dev/docs/migrate).

## @fumapress/language@1.0.0-beta.0 (beta)

### Redesign the core API for v1

Layouts move onto the config object (`renderPage`, `renderRoot`, `renderNotFound`, `defaultLayoutProps`), `content` replaces `loader`, and plugin types are renamed (`PressPlugin`, `AppShape`).

See the [migration guide](https://press.fumadocs.dev/docs/migrate).

## @fumapress/language@0.1.0

### Default to Base UI

CLI & internal packages now use Base UI over Radix UI by default.

### Auto-detect CJS deps with export maps

The Vite plugin now pre-bundles CJS dependencies that ship an `exports` field (e.g. `use-sync-external-store` pulled in by Base UI), including their deep imports. The manual `optimizeDeps.include` workaround and the direct `use-sync-external-store` dependency are no longer needed.

### Use cnfast for class merging

Class name helpers now use `cnfast` instead of `tailwind-merge` directly for compatible Tailwind class merging with faster runtime performance.

## @fumapress/language@0.0.2

### Bump deps

Use Waku beta 6 and AI SDK 7.
