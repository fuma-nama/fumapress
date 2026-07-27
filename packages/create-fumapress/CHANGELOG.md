## create-fumapress@0.1.4

### Use Fumadocs MDX macro API

Scaffolded apps define collections with `fumadocs-mdx/macro` in `press.config.tsx` instead of `source.config.ts` codegen.

## create-fumapress@0.1.0

### Default to Base UI

CLI & internal packages now use Base UI over Radix UI by default.

### Auto-detect CJS deps with export maps

The Vite plugin now pre-bundles CJS dependencies that ship an `exports` field (e.g. `use-sync-external-store` pulled in by Base UI), including their deep imports. The manual `optimizeDeps.include` workaround and the direct `use-sync-external-store` dependency are no longer needed.

## create-fumapress@0.0.17

### Bump deps

Use Waku beta 6 and AI SDK 7.

# create-fumapress

## 0.0.16

## 0.0.15

## 0.0.14

## 0.0.13

## 0.0.12

## 0.0.11

## 0.0.10

## 0.0.9

### Patch Changes

- 793f82d: Support built-in content loader API with revalidation

## 0.0.8

## 0.0.7

## 0.0.6

## 0.0.5

## 0.0.4

## 0.0.3

### Patch Changes

- d19df8b: fix build

## 0.0.2
