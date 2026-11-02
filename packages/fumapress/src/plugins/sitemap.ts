import { pageAlternate, type AppShape, type PageAlternate } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";
import type { PressRoute } from "@/lib/types";
import * as Press from "@fumapress/core/plugins/sitemap";
import type { Context } from "@fumapress/core";

export {
  buildSitemap,
  type SitemapAlternateLink,
  type SitemapAPI,
  type SitemapChangeFrequency,
  type SitemapImage,
  type SitemapLastMod,
  type SitemapNews,
  type SitemapOptions,
  type SitemapUrl,
  type SitemapVideo,
} from "@fumapress/core/plugins/sitemap";

/** @deprecated use `SitemapUrl["priority"]` */
export type SitemapPriority = NonNullable<Press.SitemapUrl["priority"]>;

/** a sitemap of the content pages, with their translations and last modified dates, and of the pages of `createPage()` */
export function sitemapPlugin<C extends AppShape = AppShape>(
  options: Press.SitemapOptions<NoInfer<C>> = {},
): PressPlugin<C> {
  const { additionalEntries = [] } = options;
  let routes: PressRoute[] = [];

  return {
    ...Press.sitemapPlugin<C>({
      ...options,
      async additionalEntries() {
        const entries = await routeEntries(this, routes);
        entries.push(
          ...(typeof additionalEntries === "function"
            ? await additionalEntries.call(this)
            : additionalEntries),
        );
        return entries;
      },
    }),
    configureRoutes({ getRoutes }) {
      routes = getRoutes();
    },
  };
}

/** the pages of `routes`, without the ones at the URL of content pages: `getEntry` lists them */
async function routeEntries<C extends AppShape>(
  ctx: Context<C>,
  routes: PressRoute[],
): Promise<Press.SitemapUrl[]> {
  const pageLocs = new Set<string>();
  for (const page of (await ctx.getLoader()).getPages()) pageLocs.add(ctx.absoluteUrl(page.url));

  const entries: Press.SitemapUrl[] = [];
  for (const route of routes) {
    for (const page of route.pages) {
      const loc = ctx.absoluteUrl(page.path);
      if (pageLocs.has(loc)) continue;

      const alternates: PageAlternate[] = [];
      if (page.translations.length > 1) {
        for (const { locale, path } of page.translations) {
          alternates.push(pageAlternate(ctx, locale, path));
        }
      }
      entries.push({ loc, priority: 1, alternates });
    }
  }
  return entries;
}
