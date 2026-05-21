# fumapress

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
