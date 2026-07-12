import type { AppContext, AppShape } from "../../app/context";

export async function getTags<C extends AppShape>(ctx: AppContext<C>, page: C["page"]) {
  for (const adapter of ctx.adapters) {
    const tags = await adapter["blog:get-tags"]?.call(ctx, page);
    if (tags !== undefined) return tags;
  }
}

export async function groupTagsI18n<C extends AppShape>(
  ctx: AppContext<C>,
  blogPosts: C["page"][],
) {
  const localeToTags = new Map<string, Map<string, number>>();

  for (const page of blogPosts) {
    const tags = await getTags(ctx, page);
    if (!tags) continue;

    const locale = page.locale ?? "";
    let map = localeToTags.get(locale);
    if (!map) {
      map = new Map();
      localeToTags.set(locale, map);
    }

    for (const tag of tags) {
      const count = map.get(tag) ?? 0;
      map.set(tag, count + 1);
    }
  }

  return localeToTags;
}

export async function groupTags<C extends AppShape>(ctx: AppContext<C>, blogPosts: C["page"][]) {
  const map = new Map<string, number>();

  for (const page of blogPosts) {
    const tags = await getTags(ctx, page);
    if (!tags) continue;

    for (const tag of tags) {
      const count = map.get(tag) ?? 0;
      map.set(tag, count + 1);
    }
  }

  return map;
}
