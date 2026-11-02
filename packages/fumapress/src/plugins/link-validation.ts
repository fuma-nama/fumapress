import type { AppShape } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";
import { decodePathname } from "@/lib/pathname";
import type { PressRoute } from "@/lib/types";
import * as Press from "@fumapress/core/plugins/link-validation";

export type {
  Diagnostic,
  DiagnosticsFile,
  LinkValidationOptions,
} from "@fumapress/core/plugins/link-validation";

/**
 * Validate the links in the Markdown of pages (`getPageText()`) when the site is built.
 *
 * Links can point to pages and their headings (`getPageToc()`), to the routes of plugins and to the pages of `createPage()`. Outside `static` mode, a link counts when the middleware of plugins serves it.
 */
export function linkValidationPlugin<C extends AppShape = AppShape>(
  options: Press.LinkValidationOptions = {},
): PressPlugin<C> {
  let routes: PressRoute[] = [];

  return {
    ...Press.linkValidationPlugin<C>({
      ...options,
      ignored: (href) => options.ignored?.(href) === true || isPageOf(routes, href),
    }),
    configureRoutes({ getRoutes }) {
      routes = getRoutes();
    },
  };
}

/** whether `href` is the path of a page of `routes`: the pages of static routes, the pattern of dynamic ones */
function isPageOf(routes: PressRoute[], href: string): boolean {
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  let pathname = decodePathname(new URL(href, "http://localhost").pathname);
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);

  return routes.some((route) =>
    route.render === "static"
      ? route.pages.some((page) => page.path === pathname)
      : matches(route.path, pathname),
  );
}

/** whether `pathname` matches a route pattern: `[name]` is a segment and `[...name]` the rest */
function matches(pattern: string, pathname: string): boolean {
  const parts = pattern.split("/");
  const segments = pathname.split("/");
  for (const [i, part] of parts.entries()) {
    if (part.startsWith("[...")) return segments.length > i;
    if (i >= segments.length || (!part.startsWith("[") && part !== segments[i])) return false;
  }
  return parts.length === segments.length;
}
