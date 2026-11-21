## @fumapress/core@0.2.0

### Files for agents in `llmsPlugin()`

- `/llms.txt` links pages to their Markdown, like `/docs/install.md`.
- Root folders get their own `llms-full.txt`, like `/docs/llms-full.txt`, linked from their line in `/llms.txt`, so large docs can be read section by section.
- Added the `section` option, which chooses the sections, and can collapse a section into one link to its own `llms.txt`.
- Added the `filter` option, which leaves pages out of the files.
- Pages link their Markdown in `<head>` with `<link rel="alternate" type="text/markdown">`.
- Needs Fumadocs 16.19.3 or later.

## @fumapress/core@0.1.1

### Named a default plugin listed twice in more errors

- Listing a default plugin that adds a slot item, like `vercelImage()`, says that it is added twice, like plugins that add a route.

## @fumapress/core@0.1.0

### Shared engine of Fumapress

- `@fumapress/core` is the internal engine of `fumapress` and `@fumapress/astro`. Sites import from those two packages.

### Fixes

- Content pages are served at the URLs of the `url` option of `createPress()`.
- Boolean attributes of head tags, like `async: ""`, are kept.
- Page actions and the feedback form reset on client navigation, and no empty row is left without actions.
- A rest param in a custom page path, like `/[...lang]/about`, matches only its own paths.
