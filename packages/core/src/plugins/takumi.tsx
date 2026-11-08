import type { ReactNode } from "react";
import { ImageResponse, type ImageResponseOptions } from "takumi-js/response";
import type { Context } from "../context";
import type { HeadTag } from "../head";
import type { AppShape, Awaitable, PageData, Plugin } from "../plugin";
import {
  fallbackOrigin,
  joinPaths,
  matchRoute,
  stripBase,
  type PageRoute,
  type RouteHandler,
  type RouteParams,
} from "../routes";

/** `ImageResponseOptions` of a WebP image, the plugin sets `format` itself */
export type TakumiImageOptions = ImageResponseOptions extends infer T
  ? T extends { format?: "webp" }
    ? Omit<T, "format">
    : never
  : never;

export interface TakumiOptions<C extends AppShape = AppShape> {
  /**
   * The base route for generated images.
   *
   * By default, it is `/` for images of static routes, `/_takumi` for the ones rendered on demand.
   */
  path?: string;
  /** @defaultValue 1200 */
  width?: number;
  /** @defaultValue 630 */
  height?: number;

  /**
   * Options shared by every image, `getImage()` overrides them per page.
   *
   * Values resolved once belong here, like the fonts from `googleFonts()` of `takumi-js/helpers`.
   * On runtimes that can't load the native addon, pass the WebAssembly build of `takumi-js/wasm` as `module`.
   */
  options?: TakumiImageOptions;

  /** the image of a content page, defaults to its title, description and the site name */
  getImage?: (this: Context<C>, page: C["page"]) => Awaitable<TakumiImage>;
}

export interface TakumiImage {
  node: ReactNode;
  /** over the shared `options` */
  options?: TakumiImageOptions;
}

/** the image of a page (`ogImage` of its data): a `node` to draw, or `title` and `description` for the default template */
export interface OGImageRoute extends Partial<TakumiImage> {
  title?: string;
  description?: string;
}

declare module "@fumapress/core" {
  interface PageData {
    /**
     * The Open Graph image of a page route (`data` of a view or of `getConfig()`), drawn by `takumiPlugin()`. A function
     * gets the params of the rendered path, `takumiPlugin()` calls it before the page data reaches `ui.renderPage`.
     */
    ogImage?: OGImageRoute | ((this: Context, params: RouteParams) => Awaitable<OGImageRoute>);
  }
}

/** the path segments of a page's image, `index.webp` for the root page */
function imageSegments(slugs: string[]): string[] {
  if (slugs.length === 0) return ["index.webp"];
  const out = slugs.slice(0, -1);
  out.push(`${slugs[slugs.length - 1]}.webp`);
  return out;
}

/** the slugs of a page from the segments of its image path */
function pageSlugs(segments: string[]): string[] {
  const out = segments.slice();
  if (out.length > 0) out[out.length - 1] = out[out.length - 1]!.replace(/\.webp$/, "");
  if (out.length === 1 && out[0] === "index") out.pop();
  return out;
}

/**
 * Open Graph images of content pages with Takumi, requires `takumi-js`.
 *
 * Every language gets an image route, fallback pages use the image of the page they fall back to. Pages of page routes
 * with `ogImage` in their page data get one too: prerendered for static routes, rendered on demand for dynamic ones.
 */
export function takumiPlugin<C extends AppShape = AppShape>(
  options: TakumiOptions<NoInfer<C>> = {},
): Plugin<C> {
  const { width = 1200, height = 630 } = options;

  /** the response of an image, with the size and the shared `options` of the plugin */
  function renderImage(image: TakumiImage): ImageResponse {
    return new ImageResponse(image.node, {
      width,
      height,
      ...options.options,
      ...image.options,
      format: "webp",
    });
  }

  /** the head tags of the image at `url` */
  function imageTags(url: string): HeadTag[] {
    return [
      { tag: "meta", attrs: { property: "og:image", content: url } },
      { tag: "meta", attrs: { property: "og:image:width", content: String(width) } },
      { tag: "meta", attrs: { property: "og:image:height", content: String(height) } },
      { tag: "meta", attrs: { property: "twitter:card", content: "summary_large_image" } },
    ];
  }

  /** the image of page data: its `ogImage`, drawn by the default template unless it has a `node` */
  function dataImage(ctx: Context<C>, { title, description, ogImage = {} }: PageData): TakumiImage {
    // `transformPage` called a function form
    const image = ogImage as OGImageRoute;
    return {
      node:
        image.node ??
        generate({
          title: image.title ?? title,
          description: image.description ?? description,
          site: ctx.siteConfig.name,
        }),
      options: image.options,
    };
  }

  async function defaultImage(this: Context<C>, page: C["page"]): Promise<TakumiImage> {
    return dataImage(this, await this.getPageData(page));
  }

  /** the base route of images without a trailing slash, empty at the root */
  function basePath(render: PageRoute["render"]): string {
    const path = options.path ?? "/";
    const base = path.replace(/^\/?/, "/").replace(/\/$/, "");
    // at the root it would take every path
    return render === "dynamic" ? base || "/_takumi" : base;
  }

  /** a static page gets a `.webp` file next to it, a dynamic page an image route with its params under `/_takumi` */
  function routeImagePath(route: PageRoute<C>, pathname: string): string {
    const base = basePath(route.render);
    if (route.render === "dynamic") return joinPaths("/", base, pathname);
    return joinPaths("/", base, pathname === "/" ? "index.webp" : `${pathname}.webp`);
  }

  return {
    name: "core:takumi",
    async transformPage({ ogImage }, { route, path }) {
      if (typeof ogImage !== "function") return;
      const params =
        route && path !== undefined
          ? (route.pages.find((item) => item.path === path)?.params ?? matchRoute(route.path, path))
          : undefined;
      return { ogImage: await ogImage.call(this, params ?? {}) };
    },
    async head({ page, route, path }) {
      if (route && path !== undefined) {
        const { ogImage } = await this.getPageData(route, path);
        if (ogImage) return imageTags(this.absoluteUrl(routeImagePath(route, path)));
        return;
      }
      if (!page) return;
      // fallback pages have no image of their own, point at the origin's
      const target = fallbackOrigin(await this.getLoader(), this.i18nConfig, page) ?? page;
      return imageTags(
        this.absoluteUrl(
          this.localizePath(
            target.locale,
            `${basePath(this.getContentRender(target.type))}/${imageSegments(page.slugs).join("/")}`,
          ),
        ),
      );
    },
    async routes({ createApi }) {
      const source = await this.getLoader();

      for (const lang of this.languages) {
        const staticPaths: string[][] = [];
        for (const page of source.getPages(lang)) {
          if (
            this.getContentRender(page.type) === "static" &&
            !fallbackOrigin(source, this.i18nConfig, page)
          )
            staticPaths.push(imageSegments(page.slugs));
        }

        const GET: RouteHandler = async (_request, { params }) => {
          const page =
            Array.isArray(params.slugs) &&
            (await this.getLoader()).getPage(pageSlugs(params.slugs), lang);
          if (!page) return new Response(null, { status: 404 });

          const response = renderImage(await (options.getImage ?? defaultImage).call(this, page));
          const cacheControl = this.getCacheControl(page);
          if (cacheControl) response.headers.set("Cache-Control", cacheControl);
          return response;
        };
        const path = (render: PageRoute["render"]) =>
          this.localizePath(lang, `${basePath(render)}/[...slugs]`);
        if (staticPaths.length > 0 || this.getContentRender() === "static")
          createApi({ path: path("static"), render: "static", staticPaths, GET });
        if (this.getContentRender() === "dynamic") createApi({ path: path("dynamic"), GET });
      }
    },
    async deriveRoutes({ createApi }, { routes }) {
      for (const route of routes) {
        // a dynamic route can have an image on any of its paths
        if (route.render === "dynamic") {
          createApi({
            path: routeImagePath(route, route.path),
            GET: async (request) => {
              const site = stripBase(new URL(request.url).pathname, this.withBase("/"));
              const path = site && stripBase(decodeURI(site), basePath("dynamic"));
              if (path === undefined) return new Response(null, { status: 404 });
              const data = await this.getPageData(route, path.replace(/(.)\/$/, "$1"));
              if (!data.ogImage) return new Response(null, { status: 404 });
              return renderImage(dataImage(this, data));
            },
          });
          continue;
        }
        for (const { path } of route.pages) {
          const data = await this.getPageData(route, path);
          if (!data.ogImage) continue;
          createApi({
            path: routeImagePath(route, path),
            render: "static",
            GET: () => renderImage(dataImage(this, data)),
          });
        }
      }
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
