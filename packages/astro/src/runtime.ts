import type { AstroGlobal } from "astro";
import { stripBase, type Press, type PressContext, type PressLang } from "@fumapress/core";
import { pathLocale, siteI18n } from "@fumapress/core/runtime";
import { ctx } from "./routes/context";
import type { ProviderData } from "./ui/content";

/** the site, for custom pages and routes: `getPressContext<typeof app>()` */
export function getPressContext<A extends Press<any, any> = Press>(): PressContext<A> {
  return ctx as unknown as PressContext<A>;
}

/**
 * The props of providers on custom pages, like `<Content provider={getProviderData(Astro)} />`.
 *
 * @param lang - the language of the page, from its URL prefix by default
 */
export function getProviderData<A extends Press<any, any> = Press>(
  astro: Pick<AstroGlobal, "url" | "params">,
  lang?: PressLang<A>,
): ProviderData {
  // like the URLs of pages, prerendering with `build.format: "file"` gives the path of the file
  const pathname =
    (stripBase(astro.url.pathname, ctx.withBase("/")) ?? astro.url.pathname).replace(
      /(?:\/index\.html|\.html|(.)\/)$/,
      "$1",
    ) || "/";
  return {
    pathname,
    params: astro.params,
    i18n: siteI18n(ctx, { lang: lang ?? pathLocale(ctx, pathname) }),
  };
}
