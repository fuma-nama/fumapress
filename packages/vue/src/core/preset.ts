import { llmsPlugin, type LLMsOptions } from "../plugins/llms.txt";
import { robotsPlugin, type RobotsOptions } from "../plugins/robots";
import { searchPlugin } from "../plugins/search";
import { sitemapPlugin, type SitemapOptions } from "../plugins/sitemap";
import type { PresetEntry } from "./plugin";

/** the options of each default plugin, `false` leaves it out */
export interface RecommendedPresetOptions {
  sitemap?: SitemapOptions | false;
  robots?: RobotsOptions | false;
  llms?: LLMsOptions | false;
  search?: false;
}

/** Sitemap, robots.txt, llms.txt and search. To replace one, set it to `false` and list your plugin. */
export function recommendedPreset(options: RecommendedPresetOptions = {}): PresetEntry[] {
  const { sitemap, robots, llms, search } = options;
  const out: PresetEntry[] = [];
  if (sitemap !== false) out.push(() => sitemapPlugin(sitemap));
  if (robots !== false) {
    out.push(() =>
      robotsPlugin({
        sitemap: sitemap === false ? false : (sitemap?.path ?? "/sitemap.xml"),
        ...robots,
      }),
    );
  }
  if (llms !== false) out.push(() => llmsPlugin(llms));
  if (search !== false) out.push(() => searchPlugin());
  return out;
}
