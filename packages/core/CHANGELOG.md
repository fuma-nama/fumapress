# fumapress

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
