import type { ReactNode } from "react";
import type { ApiRoute, HeadTag } from "fumadocs-core/framework/plugin";
import { ImageResponse, type ImageResponseOptions } from "takumi-js/response";
import type { Context } from "../context";
import type { AppShape, Awaitable, Plugin } from "../plugin";

/** `ImageResponseOptions` of a WebP image, the plugin sets `format` and the size itself */
export type TakumiImageOptions = ImageResponseOptions extends infer T
  ? T extends { format?: "webp" }
    ? Omit<T, "format" | "width" | "height">
    : never
  : never;

export interface TakumiOptions<C extends AppShape = AppShape> {
  /**
   * The URL prefix of images, without the base path and the language.
   *
   * @defaultValue "/og"
   */
  basePath?: string;
  /** @defaultValue 1200 */
  width?: number;
  /** @defaultValue 630 */
  height?: number;

  /**
   * Options shared by every image, `generate()` overrides them per page.
   *
   * Values resolved once belong here, like the fonts from `googleFonts()` of `takumi-js/helpers`.
   * On runtimes that can't load the native addon, pass the WebAssembly build of `takumi-js/wasm` as `module`.
   */
  options?: TakumiImageOptions;

  /** the image of a page, defaults to its title, description and the site name */
  generate?: (this: Context<C>, page: C["page"]) => Awaitable<TakumiImage>;
}

export interface TakumiImage {
  node: ReactNode;
  /** over the shared `options` */
  options?: TakumiImageOptions;
}

/** the API of the Takumi plugin, from `this.getPlugin("takumi")?.api` */
export interface TakumiAPI extends Required<Pick<TakumiOptions, "basePath" | "width" | "height">> {
  /** the response of an image, in the size and with the shared `options` of the plugin */
  render: (image: TakumiImage) => ImageResponse;
}

/** the path segments of a page's image, `index.webp` for the root page */
function imageSegments(slugs: string[]): string[] {
  if (slugs.length === 0) return ["index.webp"];
  const out = slugs.slice(0, -1);
  out.push(`${slugs[slugs.length - 1]}.webp`);
  return out;
}

/** the slugs of a page from the segments of its image path, `undefined` for other paths */
function pageSlugs(segments: string[]): string[] | undefined {
  const last = segments.at(-1);
  if (!last?.endsWith(".webp")) return;
  const out = segments.slice(0, -1);
  if (out.length > 0 || last !== "index.webp") out.push(last.slice(0, -".webp".length));
  return out;
}

/**
 * Open Graph images of content pages with Takumi, requires `takumi-js`.
 *
 * Every language gets an image route, fallback pages use the image of the page they fall back to.
 */
export function takumiPlugin<C extends AppShape = AppShape>(
  options: TakumiOptions<NoInfer<C>> = {},
): Plugin<C> {
  const { width = 1200, height = 630 } = options;
  const api: TakumiAPI = {
    basePath: (options.basePath ?? "/og").replace(/\/$/, ""),
    width,
    height,
    render: (image) =>
      new ImageResponse(image.node, {
        ...options.options,
        ...image.options,
        width,
        height,
        format: "webp",
      }),
  };

  async function defaultImage(this: Context<C>, page: C["page"]): Promise<TakumiImage> {
    const { title, description } = await this.getPageData(page);
    return { node: generate({ title, description, site: this.siteConfig.name }) };
  }

  async function imageUrl(ctx: Context<C>, page: C["page"]): Promise<string> {
    const { locale, slugs } = (await ctx.getFallbackOrigin(page)) ?? page;
    return ctx.absoluteUrl(
      ctx.localizePath(locale, `${api.basePath}/${imageSegments(slugs).join("/")}`),
    );
  }

  return {
    name: "takumi",
    provides: ["og-image"],
    api,
    async transformPage(data, page) {
      return { ...data, image: await imageUrl(this, page) };
    },
    // `og:image` comes from `image` of the page data
    head({ page }) {
      if (!page) return;
      const tags: HeadTag[] = [
        { tag: "meta", attrs: { property: "og:image:width", content: String(width) } },
        { tag: "meta", attrs: { property: "og:image:height", content: String(height) } },
      ];
      return tags;
    },
    async routes() {
      const source = await this.getLoader();
      const routes: ApiRoute[] = [];

      for (const lang of this.i18nConfig?.languages ?? [undefined]) {
        const staticPaths: string[][] = [];
        for (const page of source.getPages(lang)) {
          if (!(await this.getFallbackOrigin(page))) staticPaths.push(imageSegments(page.slugs));
        }

        routes.push({
          path: this.localizePath(lang, `${api.basePath}/[...slugs]`),
          staticPaths,
          GET: async (_request, { params }) => {
            const slugs = Array.isArray(params.slugs) ? pageSlugs(params.slugs) : undefined;
            const page = slugs && (await this.getLoader()).getPage(slugs, lang);
            if (!page || (await this.getFallbackOrigin(page)))
              return new Response(null, { status: 404 });

            return api.render(await (options.generate ?? defaultImage).call(this, page));
          },
        });
      }

      return routes;
    },
  };
}

/** the default image: the title, description and site name */
export function generate({
  site,
  title,
  description,
}: {
  title?: string;
  description?: string;
  site?: string;
}): ReactNode {
  const primaryColor = "rgba(255,150,255,0.3)";
  const primaryTextColor = "rgb(255,150,255)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        color: "white",
        padding: "4rem",
        backgroundColor: "#0c0c0c",
        borderBottom: `18px solid ${primaryColor}`,
      }}
    >
      <p style={{ fontWeight: 800, fontSize: "82px", margin: 0 }}>{title}</p>
      <p
        style={{
          fontSize: "52px",
          color: "rgba(240,240,240,0.8)",
          margin: 0,
          marginTop: "16px",
          paddingBottom: "28px",
          borderBottom: `10px dashed ${primaryColor}`,
        }}
      >
        {description}
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "20px",
          marginTop: "auto",
          color: primaryTextColor,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle cx="12" cy="12" r="11" stroke={primaryTextColor} strokeWidth="2" />
        </svg>
        {site && <p style={{ fontSize: "56px", fontWeight: 600, margin: 0 }}>{site}</p>}
      </div>
    </div>
  );
}
