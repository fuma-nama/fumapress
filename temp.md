# Breaking changes (core refactor)

Draft notes for the upcoming Fumapress core API reshape. Not a changelog entry.

## Config API

### `content` is required; `loader` is removed

`defineConfig({ loader })` is gone. Pass sources via `content` only.

```ts
// before
defineConfig({ loader: docs.toFumadocsSource() });

// after
defineConfig({ content: docs.toFumadocsSource() });
```

### Layouts moved onto the config object

`Layouts`, `.layouts()`, and `.useLayouts()` are removed.

| Before                       | After                |
| ---------------------------- | -------------------- |
| `.layouts({ root })`         | `renderRoot`         |
| `.layouts({ page })`         | `renderPage`         |
| `.layouts({ notFound })`     | `renderNotFound`     |
| `.layouts({ defaultProps })` | `defaultLayoutProps` |

```ts
// before
defineConfig({ content }).layouts({
  defaultProps() {
    return { links: [...] };
  },
  page: createDocsLayoutPage(),
});

// after — prefer typed layout + renderPage wrapper (avoids TS inference issues)
const DocsLayout = createDocsLayoutPage<typeof config.$context>();

const config = defineConfig({
  content,
  defaultLayoutProps: {
    links: [...],
  },
  renderPage: (props) => <DocsLayout {...props} />,
});
```

Prefer `renderPage: (props) => <Layout {...props} />` over passing `create*LayoutPage()` directly into the config.

### Builder rename

- `ConfigBuilder` → `ConfigUtils`
- `.usePlugins()` / `.useAdapters()` removed (use `.plugins()` / `.adapters()`)
- When you need `getPressContext`, prefer `export const { getPressContext } = config.utils()` over importing it from `fumapress` (already typed to your app).

## Types & exports

| Removed / renamed                     | Replacement                             |
| ------------------------------------- | --------------------------------------- |
| `ConfigContext`                       | `AppShape`                              |
| `ServerPlugin` / `ServerPluginOption` | `PressPlugin` / `PressPluginOption`     |
| `ConfigBuilder`                       | `ConfigUtils`                           |
| `Layouts`                             | config `render*` / `defaultLayoutProps` |
| `i18n` on context shape               | `lang` on `AppShape`                    |

```ts
// before
import type { ConfigContext, ServerPlugin } from "fumapress";
export function myPlugin<C extends ConfigContext>(): ServerPlugin<C> { ... }

// after
import type { AppShape, PressPlugin } from "fumapress";
export function myPlugin<C extends AppShape>(): PressPlugin<C> { ... }
```

`$context` is now an `AppShape` (`page` / `meta` / `lang` / `source`), not a `ConfigContext`.

## App context

Moved from internal shared helpers onto `AppContext` methods:

| Before                            | After                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `ctx.layouts`                     | `ctx.renderRoot` / `ctx.renderPage` / `ctx.renderNotFound` / `ctx.defaultLayoutProps()` |
| `renderPageMeta(page, ctx)`       | `ctx.renderPageMeta(page)`                                                              |
| `renderRootMeta(ctx)`             | `ctx.renderRootMeta()`                                                                  |
| `getCreationDate(ctx, page)`      | `ctx.getPageCreatedAt(page)`                                                            |
| `getLastModifiedDate(ctx, page)`  | `ctx.getPageLastModified(page)`                                                         |
| `getGitHubFileUrl(ctx, path)`     | `ctx.getFileGitHubUrl(path)`                                                            |
| `renderToc(ctx, page)`            | `ctx.getPageToc(page)`                                                                  |
| `renderBody` / `core:render-body` | `ctx.getPageBody(page)` → `{ node }`                                                    |
| `data["core:page-meta"]`          | `ctx.interceptPageMeta(...)`                                                            |
| `data["core:*-layout"].renderers` | `transformers` (`({ page, data }) => data`)                                             |

## Adapters

`core:render-body` → `core:get-body`, returning `{ node }` instead of a bare `ReactNode`:

```ts
// before
async "core:render-body"(page) {
  return <MyPage />;
}

// after
async "core:get-body"(page) {
  return { node: <MyPage /> };
}
```

## Plugins

Custom plugins typed against `ServerPlugin` / `ConfigContext` must switch to `PressPlugin` / `AppShape`.

Takumi (and anything that appended OG tags via `data["core:page-meta"]`) must use `interceptPageMeta`:

```ts
this.interceptPageMeta(({ page, next }) => (
  <>
    {next()}
    <meta property="og:image" content={...} />
  </>
));
```
