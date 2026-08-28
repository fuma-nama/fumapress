## @fumapress/obsidian@1.1.2

### Loosen `fumapress` dependency ranges

Peer dependencies on `fumapress` (and `@fumapress/*`) now publish as `^x.y.z` instead of an exact version pin, so these packages stay compatible with newer core releases without needing a re-release.

## @fumapress/obsidian@1.0.0

### Redesign the core API for v1

Layouts move onto the config object (`renderPage`, `renderRoot`, `renderNotFound`, `defaultLayoutProps`), `content` replaces `loader`, and plugin types are renamed (`PressPlugin`, `AppShape`).

See the [migration guide](https://press.fumadocs.dev/docs/migrate).

### Add the Obsidian content integration

Render Obsidian vaults directly in Fumapress with server-side components, search and LLM text adapters, and development hot reload.

### Use Waku beta 8

Bump dependencies.

## @fumapress/obsidian@1.0.0-beta.0 (beta)

### Redesign the core API for v1

Layouts move onto the config object (`renderPage`, `renderRoot`, `renderNotFound`, `defaultLayoutProps`), `content` replaces `loader`, and plugin types are renamed (`PressPlugin`, `AppShape`).

See the [migration guide](https://press.fumadocs.dev/docs/migrate).

### Add the Obsidian content integration

Render Obsidian vaults directly in Fumapress with server-side components, search and LLM text adapters, and development hot reload.

### Use Waku beta 8

Bump dependencies.
