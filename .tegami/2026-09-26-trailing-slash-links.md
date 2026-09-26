---
packages:
  npm:fumapress: patch
---

## Internal links follow `site.trailingSlash`

With `site.trailingSlash` enabled, links rendered with `Link` now get a trailing slash too, matching the canonical URL, sitemap and RSS. This covers navigation, blog posts, tag links, site-root links in content, search results, locale switching and the i18n root redirect, so hosts like Netlify no longer answer them with a redirect.

Links to files (a `.` in the last segment), external URLs, relative links and bare `#hash` or `?query` links are kept as is. `ctx.absoluteUrl()` also keeps the query and hash after the slash now.
