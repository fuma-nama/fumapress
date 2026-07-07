## @fumapress/sanity@0.1.0

### Default to Base UI

CLI & internal packages now use Base UI over Radix UI by default.

### Auto-detect CJS deps with export maps

The Vite plugin now pre-bundles CJS dependencies that ship an `exports` field (e.g. `use-sync-external-store` pulled in by Base UI), including their deep imports. The manual `optimizeDeps.include` workaround and the direct `use-sync-external-store` dependency are no longer needed.

### Use cnfast for class merging

Class name helpers now use `cnfast` instead of `tailwind-merge` directly for compatible Tailwind class merging with faster runtime performance.

## @fumapress/sanity@0.0.11

### Bump deps

Use Waku beta 6 and AI SDK 7.

# @fumapress/sanity

## 0.0.10

### Patch Changes

- Updated dependencies [ca207d9]
- Updated dependencies [5d7e41d]
  - fumapress@0.6.2

## 0.0.9

### Patch Changes

- Updated dependencies [944bd1c]
  - fumapress@0.6.1

## 0.0.8

### Patch Changes

- Updated dependencies [16d246d]
  - fumapress@0.6.0

## 0.0.7

### Patch Changes

- Updated dependencies [892ff9f]
  - fumapress@0.5.5

## 0.0.6

### Patch Changes

- Updated dependencies [fe349d3]
  - fumapress@0.5.4

## 0.0.5

### Patch Changes

- Updated dependencies [719a1da]
- Updated dependencies [ea0439d]
- Updated dependencies [67609a3]
- Updated dependencies [5f93010]
  - fumapress@0.5.3

## 0.0.4

### Patch Changes

- Updated dependencies [a7e1829]
- Updated dependencies [4a73ee5]
  - fumapress@0.5.2

## 0.0.3

### Patch Changes

- Updated dependencies [793f82d]
- Updated dependencies [6c089fd]
- Updated dependencies [9ea0ee6]
  - fumapress@0.5.1

## 0.0.2

### Patch Changes

- Updated dependencies [426e392]
- Updated dependencies [0fe67b0]
- Updated dependencies [c8a2fbd]
- Updated dependencies [be15a6f]
- Updated dependencies [60b23a7]
  - fumapress@0.5.0
