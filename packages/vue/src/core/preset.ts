import { llmsPlugin, type LLMsOptions } from "../plugins/llms.txt";
import { robotsPlugin, type RobotsOptions } from "../plugins/robots";
import { searchPlugin, type SearchOptions } from "../plugins/search";
import { sitemapPlugin, type SitemapOptions } from "../plugins/sitemap";
import type { AppShape, Plugin, PresetEntry } from "./plugin";

/** the options of each default plugin, `false` leaves it out */
export interface RecommendedPresetOptions<C extends AppShape = AppShape> {
  sitemap?: SitemapOptions<C> | false;
  robots?: RobotsOptions | false;
  llms?: LLMsOptions<C> | false;
  search?: SearchOptions<C> | false;
}

/**
 * Sitemap, robots.txt, llms.txt and search. To replace one, set it to `false` and list your plugin. Typed by the site
 * in `.config()`: `filter` receives its pages.
 */
export function recommendedPreset<C extends AppShape = AppShape>(
  options: RecommendedPresetOptions<NoInfer<C>> = {},
): PresetEntry<Plugin<C, any>>[] {
  const { sitemap, robots, llms, search } = options;
  const out: PresetEntry<Plugin<C, any>>[] = [];
  if (sitemap !== false) out.push(() => sitemapPlugin<C>(sitemap));
  if (robots !== false) {
    out.push(() =>
      robotsPlugin({
        sitemap: sitemap === false ? false : sitemap?.path,
        ...robots,
      }),
    );
  }
  if (llms !== false) out.push(() => llmsPlugin<C>(llms));
  if (search !== false) out.push(() => searchPlugin<C>(search));
  return out;
}
