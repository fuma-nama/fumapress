import type { AppContext, AppShape } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";
import * as Press from "@fumapress/core/plugins/rss";

export { buildRSS, type RSSChannel, type RSSItem } from "@fumapress/core/plugins/rss";

export interface RSSOptions<C extends AppShape = AppShape> extends Press.RSSOptions<
  C,
  AppContext<C>
> {}

export function rssPlugin<C extends AppShape = AppShape>(
  options?: RSSOptions<NoInfer<C>>,
): PressPlugin<C> {
  return Press.rssPlugin<C, AppContext<C>>(options);
}
