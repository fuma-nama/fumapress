---
packages:
  npm:fumapress: minor
---

### Blog authors, cover images and post navigation

`blogPageSchema` now includes `date`, `authors` and `image`. Register authors once with the `authors` option of `blogPlugin()`, the default layouts render the rest:

- post pages show the authors, the publish date, and links to the newer and older posts.
- post cards show the cover image and author avatars.

Other content sources supply the new fields through the `blog:get-authors` and `blog:get-image` adapter hooks.

### Blog helpers for custom layouts

`fumapress/plugins/blog` exports `getBlogPosts()`, `getAdjacentPosts()`, `getBlogAuthors()` and `tagSlug()`, so custom layouts no longer sort posts or resolve authors themselves.

### Tag pages use lowercase, URL-encoded slugs

Tag routes and links go through `tagSlug()`, so tags with spaces or capitals resolve. Tags match case-insensitively, and the tag page shows the tag as written in posts.
