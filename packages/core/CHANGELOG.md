## @fumapress/core@0.1.0

### Shared engine of Fumapress

- `@fumapress/core` is the internal engine of `fumapress` and `@fumapress/astro`. Sites import from those two packages.

### Fixes

- Content pages are served at the URLs of the `url` option of `createPress()`.
- Boolean attributes of head tags, like `async: ""`, are kept.
- Page actions and the feedback form reset on client navigation, and no empty row is left without actions.
- A rest param in a custom page path, like `/[...lang]/about`, matches only its own paths.
