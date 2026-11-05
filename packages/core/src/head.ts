import type { AppShape, PageEnv, View } from "./plugin";
import type { Context, RuntimeContext } from "./context";
import type { PressConfig } from "./press";
import { fallbackOrigin, type PageRoute } from "./routes";

/** a tag in `<head>`, rendered in order */
export interface HeadTag {
  tag: "title" | "meta" | "link" | "script" | "style";
  /** HTML attributes, like `hreflang` */
  attrs?: Record<string, string>;
  /** text content, for `title`, `script` and `style` */
  children?: string;
}

/** `head` runs twice per page: site-wide (`{}`), then the page's own call (`{ page }`, or `{ route, path }` on page routes, with `view` on views) */
export interface HeadEnv<C extends AppShape> extends PageEnv<C> {
  route?: PageRoute<C>;
  /** the rendered path of `route`, with the language prefix, without the base path */
  path?: string;
  /** the content of a view at `path`, its `title` and `description` are the page's own */
  view?: View<any>;
}

export interface PageAlternate<C extends AppShape = AppShape> {
  lang: C["lang"];
  /** from `site.hreflang`, defaults to the language code */
  hreflang: string;
  href: string;
}

/** `hreflang` alternate of the page at `pathname` in `lang` */
export function pageAlternate(ctx: Context, lang: string, pathname: string): PageAlternate {
  return {
    lang,
    hreflang: ctx.siteConfig.hreflang?.[lang] ?? lang,
    href: ctx.absoluteUrl(pathname),
  };
}

/** canonical and `og:url` of the page at `pathname` (with `site.baseUrl`), `hreflang` links of its `alternates` */
export function pageLinks(ctx: Context, pathname: string, alternates: PageAlternate[]): HeadTag[] {
  const tags: HeadTag[] = [];
  if (ctx.siteConfig.baseUrl) {
    const href = ctx.absoluteUrl(pathname);
    tags.push(
      { tag: "link", attrs: { rel: "canonical", href } },
      { tag: "meta", attrs: { property: "og:url", content: href } },
    );
  }
  for (const { hreflang, href } of alternates)
    tags.push({ tag: "link", attrs: { rel: "alternate", hreflang, href } });
  const xDefault =
    alternates.find((item) => item.lang === ctx.i18nConfig?.defaultLanguage) ?? alternates[0];
  if (xDefault)
    tags.push({
      tag: "link",
      attrs: { rel: "alternate", hreflang: "x-default", href: xDefault.href },
    });
  return tags;
}

const headKeyAttrs = ["name", "property", "http-equiv"];

/** the key of a tag that one value per page has, like its `title` */
function headKey({ tag, attrs = {} }: HeadTag): string | undefined {
  if (tag === "title") return tag;
  if (tag === "meta") {
    for (const name of headKeyAttrs) if (attrs[name]) return `meta ${name}=${attrs[name]}`;
  }
  if (tag === "link" && attrs.rel === "canonical") return "canonical";
  if (tag === "link" && attrs.rel === "alternate" && attrs.hreflang)
    return `alternate ${attrs.hreflang}`;
}

/** the tags of `lists`, the first list wins a key; an unkeyed tag repeating another is dropped */
export function mergeHead(lists: readonly (readonly HeadTag[] | undefined)[]): HeadTag[] {
  const out: HeadTag[] = [];
  const seen = new Set<string>();
  for (const tags of lists) {
    for (const tag of tags ?? []) {
      const key = headKey(tag) ?? JSON.stringify(tag);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
  }
  return out;
}

/** `head` of `.config()` */
type SiteHead = PressConfig<AppShape, any>["head"];

/** the tags of one call of `head`, the site's first and core's last */
async function headOf(
  ctx: RuntimeContext,
  head: SiteHead,
  env: HeadEnv<AppShape>,
): Promise<HeadTag[]> {
  const own =
    typeof head === "function" ? head.call(ctx, env) : env.page || env.route ? undefined : head;
  const lists = await Promise.all([
    own,
    ...ctx.plugins.map((plugin) => plugin.head?.call(ctx, env)),
    coreHead(ctx, env),
  ]);
  return mergeHead(lists);
}

/** core's tags of a page: title, description and Open Graph of content pages, the title and description of views, canonical and `hreflang` of every page */
async function coreHead(
  ctx: RuntimeContext,
  { page, route, path, view }: HeadEnv<AppShape>,
): Promise<HeadTag[] | undefined> {
  if (route && path !== undefined) {
    const tags: HeadTag[] = [];
    if (view?.title) tags.push({ tag: "title", children: view.title });
    if (view?.description)
      tags.push({ tag: "meta", attrs: { name: "description", content: view.description } });
    const alternates: PageAlternate[] = [];
    const current = route.pages.find((item) => item.path === path);
    if (current && current.translations.length > 1) {
      for (const item of current.translations)
        if (item.lang) alternates.push(pageAlternate(ctx, item.lang, item.path));
    }
    tags.push(...pageLinks(ctx, path, alternates));
    return tags;
  }
  if (!page) return;

  const { title, description } = page.data;
  const [source, alternates] = await Promise.all([ctx.getLoader(), ctx.getPageAlternates(page)]);
  const origin = fallbackOrigin(source, ctx.i18nConfig, page);
  const tags: HeadTag[] = [{ tag: "title", children: title }];
  if (description) tags.push({ tag: "meta", attrs: { name: "description", content: description } });
  tags.push({ tag: "meta", attrs: { property: "og:title", content: title ?? "" } });
  if (description)
    tags.push({ tag: "meta", attrs: { property: "og:description", content: description } });
  tags.push(
    { tag: "meta", attrs: { property: "og:site_name", content: ctx.siteConfig.name } },
    ...pageLinks(ctx, (origin ?? page).url, alternates),
  );
  if (origin) tags.push({ tag: "meta", attrs: { name: "robots", content: "noindex" } });
  return tags;
}

/** the tags of `env` over the ones of every page, see `getHead()` of the context */
export async function collectHead(
  ctx: RuntimeContext,
  head: SiteHead,
  env: HeadEnv<AppShape>,
): Promise<HeadTag[]> {
  if (!env.page && !env.route) return headOf(ctx, head, {});
  // a page's own value wins over the one of every page
  const [own, every] = await Promise.all([headOf(ctx, head, env), headOf(ctx, head, {})]);
  return mergeHead([own, every]);
}
