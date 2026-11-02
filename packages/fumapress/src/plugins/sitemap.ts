import type { AppContext, AppShape } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";
import * as Press from "@fumapress/core/plugins/sitemap";

export {
  buildSitemap,
  type SitemapAlternateLink,
  type SitemapAPI,
  type SitemapChangeFrequency,
  type SitemapImage,
  type SitemapLastMod,
  type SitemapNews,
  type SitemapUrl,
  type SitemapVideo,
} from "@fumapress/core/plugins/sitemap";

/** @deprecated use `SitemapUrl["priority"]` */
export type SitemapPriority = NonNullable<Press.SitemapUrl["priority"]>;

export interface SitemapOptions<C extends AppShape = AppShape> extends Press.SitemapOptions<
  C,
  AppContext<C>
> {}

/** a sitemap of the content pages, with their translations and last modified dates, and of the pages of `createPage()` */
export function sitemapPlugin<C extends AppShape = AppShape>(
  options?: SitemapOptions<NoInfer<C>>,
): PressPlugin<C> {
  return Press.sitemapPlugin<C, AppContext<C>>(options);
}
