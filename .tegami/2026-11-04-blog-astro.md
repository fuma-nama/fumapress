---
packages:
  "npm:@fumapress/blog": minor
---

### Blog for Waku and Astro

- Added `@fumapress/blog`, replacing `fumapress/plugins/blog`: `blogPlugin({ source: "blog" })` renders the posts of one or more source keys, on Waku and Astro.
- Import its styles with `@import "@fumapress/blog/css/preset.css";`.
- `ui.renderPage` receives typed props for `blog.index`, `blog.tags`, `blog.tag` and the post pages, compose them with `BlogIndexView`, `BlogTagsView`, `BlogTagView` and `BlogPostView`.
- Tags, authors and cover images come from the `getTags`, `getAuthors` and `getImage` options, falling back to the frontmatter of `blogPageSchema`.
- `getBlogPosts(ctx, { lang })` lists the posts on your own pages, like a landing page. Without i18n, `getBlogPosts(ctx)`.
- Other plugins read the blog sources and authors from `getCapability("blog")`.
