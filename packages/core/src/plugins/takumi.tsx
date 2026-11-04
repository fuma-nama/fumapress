import type { ReactNode } from "react";
import type { ApiRoute, HeadTag, RouteParams } from "fumadocs-core/framework/plugin";
import { ImageResponse, type ImageResponseOptions } from "takumi-js/response";
import { fallbackOrigin, joinPaths, type Context } from "../context";
import type { AppShape, Awaitable, FrameworkRoute, Plugin } from "../plugin";

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
   * By default, it is `/` (static mode) or `/_takumi` (dynamic mode).
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

  /** the image of a content page, defaults to its title, description and the site name */
  generate?: (this: Context<C>, page: C["page"]) => Awaitable<TakumiImage>;
}

export interface TakumiImage {
  node: ReactNode;
  /** over the shared `options` */
  options?: TakumiImageOptions;
}

/** the image of a page route (`takumiOptions` of its options): a `node` to draw, or `title` and `description` for the default template */
export interface TakumiRouteImage extends Partial<TakumiImage> {
  title?: string;
  description?: string;
}

declare module "@fumapress/core" {
  interface CapabilityAPI {
    "og-image": TakumiAPI;
  }

  interface RouteOptions {
    /** the Open Graph image of the route, drawn by the `og-image` plugin of the preset; a function gets the params of the rendered path */
    takumiOptions?:
      | TakumiRouteImage
      | ((this: Context, params: RouteParams) => Awaitable<TakumiRouteImage>);
  }
}

/** the API of the `og-image` capability, from `this.getProvider("og-image")?.api` */
export interface TakumiAPI {
  /** the base route of images without a trailing slash, empty at the root, set in `init()` */
  basePath: string;
  /** the response of an image, with the size and the shared `options` of the plugin */
  render: (image: TakumiImage) => ImageResponse;
  /** the head tags of the image at `url` */
  tags: (url: string) => HeadTag[];
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
 * Every language gets an image route, fallback pages use the image of the page they fall back to. Page routes with
 * `takumiOptions` get one too: prerendered for static routes, rendered on request for dynamic ones.
 */
export function takumiPlugin<C extends AppShape = AppShape>(
  options: TakumiOptions<NoInfer<C>> = {},
): Plugin<C, { provides: "og-image" }> {
  const { width = 1200, height = 630 } = options;
  const api: TakumiAPI = {
    basePath: "",
    render: (image) =>
      new ImageResponse(image.node, {
        width,
        height,
        ...options.options,
        ...image.options,
        format: "webp",
      }),
    tags: (url) => [
      { tag: "meta", attrs: { property: "og:image", content: url } },
      { tag: "meta", attrs: { property: "og:image:width", content: String(width) } },
      { tag: "meta", attrs: { property: "og:image:height", content: String(height) } },
      { tag: "meta", attrs: { property: "twitter:card", content: "summary_large_image" } },
    ],
  };

  function defaultImage(this: Context<C>, page: C["page"]): TakumiImage {
    const { title, description } = page.data;
    return { node: generate({ title, description, site: this.siteConfig.name }) };
  }

  /** a static page gets a `.webp` file next to it, a dynamic page an image route with its params under `/_takumi` */
  function routeImagePath(route: FrameworkRoute<C>, pathname: string): string {
    if (route.render === "dynamic") return joinPaths("/", api.basePath || "/_takumi", pathname);
    return joinPaths("/", api.basePath, pathname === "/" ? "index.webp" : `${pathname}.webp`);
  }

  return {
    name: "core:takumi",
    provides: ["og-image"],
    api,
    init() {
      const basePath = options.basePath ?? (this.mode === "dynamic" ? "/_takumi" : "/");
      api.basePath = basePath.replace(/^\/?/, "/").replace(/\/$/, "");
    },
    async head({ page, route, path }) {
      if (route?.options.takumiOptions && path !== undefined)
        return api.tags(this.absoluteUrl(routeImagePath(route, path)));
      if (!page) return;
      // fallback pages have no image of their own, point at the origin's
      const origin = fallbackOrigin(await this.getLoader(), this.i18nConfig, page);
      return api.tags(
        this.absoluteUrl(
          this.localizePath(
            (origin ?? page).locale,
            `${api.basePath}/${imageSegments(page.slugs).join("/")}`,
          ),
        ),
      );
    },
    async routes() {
      const source = await this.getLoader();
      const routes: ApiRoute[] = [];

      for (const lang of this.i18nConfig?.languages ?? [undefined]) {
        const staticPaths: string[][] = [];
        for (const page of source.getPages(lang)) {
          if (!fallbackOrigin(source, this.i18nConfig, page))
            staticPaths.push(imageSegments(page.slugs));
        }

        routes.push({
          path: this.localizePath(lang, `${api.basePath}/[...slugs]`),
          staticPaths,
          GET: async (_request, { params }) => {
            const page =
              Array.isArray(params.slugs) &&
              (await this.getLoader()).getPage(pageSlugs(params.slugs), lang);
            if (!page) return new Response(null, { status: 404 });

            return api.render(await (options.generate ?? defaultImage).call(this, page));
          },
        });
      }

      return routes;
    },
    pageRoutes({ routes }) {
      const out: ApiRoute[] = [];
      for (const route of routes) {
        const image = route.options.takumiOptions;
        if (!image) continue;

        const render = async (params: RouteParams) => {
          const { node, title, description, options } =
            typeof image === "function" ? await image.call(this, params) : image;
          return api.render({
            node: node ?? generate({ title, description, site: this.siteConfig.name }),
            options,
          });
        };
        if (route.render === "dynamic") {
          out.push({
            path: routeImagePath(route, route.path),
            render: "dynamic",
            GET: (_, { params }) => render(params),
          });
          continue;
        }
        for (const { path, params } of route.pages)
          out.push({
            path: routeImagePath(route, path),
            render: "static",
            GET: () => render(params),
          });
      }
      return out;
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
