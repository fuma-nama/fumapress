---
packages:
  "npm:@fumapress/core": patch
  "npm:fumapress": patch
  "npm:@fumapress/astro": patch
---

### Plugin views and the layout slot

- Routes of plugins with a `view` render pages in the home layout of the site, in the language of their `lang`.
- `getPageView()` renders a content page in the home layout instead of the docs layout, like a blog post.
- The `layout.wrapper` slot wraps the layout of every page, and `slots()` get `page` on content pages only.
- Search plugins declare the format of their static index in a typed `getProvider("search")?.api`.
- On Waku, the `middleware()` of plugins runs on client navigations too, with the request of the page.
