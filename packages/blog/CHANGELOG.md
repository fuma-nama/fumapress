## @fumapress/blog@0.1.1

### Updated Fumadocs to 16.19.3

- Needs Fumadocs 16.19.3 or later.
- The `get_page` tool of `mcpPlugin()` accepts URLs with a hash or query, like the URLs of search results.
- Components without a Markdown form keep their MDX tag name in the Markdown of pages, also in production builds.

### Hid the empty table of contents

- Posts without headings no longer show the "Table of Contents" button of the panel.

## @fumapress/blog@0.1.0

### Blog for Waku and Astro

- `@fumapress/blog` is the blog of a Fumapress site, replacing `fumapress/plugins/blog`. `blogPlugin({ source: "blog" })` renders the posts of one or more source keys.
- Import its styles with `@import "@fumapress/blog/css/preset.css";` and its frontmatter schema `blogPageSchema` from `@fumapress/blog/schema`.
- `ui.renderPage` receives typed props for `blog.index`, `blog.tags`, `blog.tag` and the post pages. Compose them with `BlogIndexView`, `BlogTagsView`, `BlogTagView` and `BlogPostView`.
- Tags, authors and cover images come from the `getTags`, `getAuthors` and `getImage` options, falling back to the frontmatter.
- `getBlogPosts(ctx, { lang })` lists the posts on custom pages, like a landing page. Without i18n, `getBlogPosts(ctx)`.
- The index and tag pages render on demand when their content source is dynamic.
