import type { AppContext, AppShape } from "../../app/context";

export async function getTags<C extends AppShape>(ctx: AppContext<C>, page: C["page"]) {
  for (const adapter of ctx.adapters) {
    const tags = await adapter["blog:get-tags"]?.call(ctx, page);
    if (tags !== undefined) return tags;
  }
}

export async function getAuthorIds<C extends AppShape>(ctx: AppContext<C>, page: C["page"]) {
  for (const adapter of ctx.adapters) {
    const authors = await adapter["blog:get-authors"]?.call(ctx, page);
    if (authors !== undefined) return authors;
  }
}

export async function getImage<C extends AppShape>(ctx: AppContext<C>, page: C["page"]) {
  for (const adapter of ctx.adapters) {
    const image = await adapter["blog:get-image"]?.call(ctx, page);
    if (image !== undefined) return image;
  }
}

/** URL segment of a tag, tags are matched case-insensitively */
export function tagSlug(tag: string): string {
  return encodeURIComponent(tag.toLowerCase());
}

export interface TagInfo {
  /** the tag as written in the first post using it */
  tag: string;
  count: number;
}

function addTag(map: Map<string, TagInfo>, tag: string) {
  const slug = tagSlug(tag);
  const info = map.get(slug);
  if (info) info.count++;
  else map.set(slug, { tag, count: 1 });
}

/** group tags of posts by locale, then by tag slug */
export async function groupTagsI18n<C extends AppShape>(
  ctx: AppContext<C>,
  blogPosts: C["page"][],
) {
  const localeToTags = new Map<string, Map<string, TagInfo>>();

  for (const page of blogPosts) {
    const tags = await getTags(ctx, page);
    if (!tags) continue;

    const locale = page.locale ?? "";
    let map = localeToTags.get(locale);
    if (!map) {
      map = new Map();
      localeToTags.set(locale, map);
    }

    for (const tag of tags) addTag(map, tag);
  }

  return localeToTags;
}

/** group tags of posts by tag slug */
export async function groupTags<C extends AppShape>(ctx: AppContext<C>, blogPosts: C["page"][]) {
  const map = new Map<string, TagInfo>();

  for (const page of blogPosts) {
    const tags = await getTags(ctx, page);
    if (!tags) continue;

    for (const tag of tags) addTag(map, tag);
  }

  return map;
}
