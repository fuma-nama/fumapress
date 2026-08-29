---
packages:
  npm:fumapress: minor
---

### Video & news entries in sitemaps

`SitemapUrl` declared `videos` and `news` fields that were never serialized, setting them
type-checked but the values were silently dropped. They are now written to the sitemap, with the
`video` and `news` namespaces declared on the `urlset`.

`buildSitemap(entries)` is now exported, like `buildRSS`, for serving custom sitemaps from your own
routes.
