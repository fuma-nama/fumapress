---
title: Plugins
description: Add routes, middleware and head tags.
---

A plugin is an object with hooks. `this` in a hook is the context of your site.

```ts title="press.config.ts"
createPress(docs.toFumadocsSource()).plugins({
  name: "site:pages",
  routes({ createApi }) {
    createApi({
      path: "/api/pages",
      GET: () => Response.json(this.getPages().map((page) => page.url)),
    });
  },
});
```

## Built-in Plugins

These are on by default:

- `/sitemap.xml`
- `/robots.txt`
- `/llms.txt`
