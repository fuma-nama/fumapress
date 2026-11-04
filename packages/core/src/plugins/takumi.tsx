import type { ReactNode } from "react";
import type { ApiRoute, HeadTag, RouteParams } from "fumadocs-core/framework/plugin";
import { ImageResponse, type ImageResponseOptions } from "takumi-js/response";
import { fallbackOrigin, joinPaths, type Context } from "../context";
import type { AppShape, Awaitable, PageRoute, Plugin } from "../plugin";

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

/** the image of a page route (`ogImage` of its options): a `node` to draw, or `title` and `description` for the default template */
export interface OGImageRoute extends Partial<TakumiImage> {
  title?: string;
  description?: string;
}

declare module "@fumapress/core" {
  interface CapabilityAPI {
    "og-image": OGImageAPI;
  }

  interface RouteOptions {
    /** the Open Graph image of the route, drawn by the `og-image` plugin of the preset; a function gets the params of the rendered path */
    ogImage?: OGImageRoute | ((this: Context, params: RouteParams) => Awaitable<OGImageRoute>);
  }
}

/** the API of the `og-image` capability, from `this.getCapability("og-image")` */
export interface OGImageAPI {
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
 * `ogImage` get one too: prerendered for static routes, rendered on request for dynamic ones.
 */
export function takumiPlugin<C extends AppShape = AppShape>(
  options: TakumiOptions<NoInfer<C>> = {},
): Plugin<C, { provides: "og-image" }> {
  const { width = 1200, height = 630 } = options;
  const api: OGImageAPI = {
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

  /** the base route of images without a trailing slash, empty at the root */
  function basePath(ctx: Context<C>): string {
    const path = options.path ?? (ctx.mode === "dynamic" ? "/_takumi" : "/");
    return path.replace(/^\/?/, "/").replace(/\/$/, "");
  }

  /** a static page gets a `.webp` file next to it, a dynamic page an image route with its params under `/_takumi` */
  function routeImagePath(ctx: Context<C>, route: PageRoute<C>, pathname: string): string {
    const base = basePath(ctx);
    if (route.render === "dynamic") return joinPaths("/", base || "/_takumi", pathname);
    return joinPaths("/", base, pathname === "/" ? "index.webp" : `${pathname}.webp`);
  }

  return {
    name: "core:takumi",
    provides: ["og-image"],
    api,
    async head({ page, route, path }) {
      if (route?.options.ogImage && path !== undefined)
        return api.tags(this.absoluteUrl(routeImagePath(this, route, path)));
      if (!page) return;
      // fallback pages have no image of their own, point at the origin's
      const origin = fallbackOrigin(await this.getLoader(), this.i18nConfig, page);
      return api.tags(
        this.absoluteUrl(
          this.localizePath(
            (origin ?? page).locale,
            `${basePath(this)}/${imageSegments(page.slugs).join("/")}`,
          ),
        ),
      );
    },
    async apiRoutes() {
      const source = await this.getLoader();
      const routes: ApiRoute[] = [];

      for (const lang of this.i18nConfig?.languages ?? [undefined]) {
        const staticPaths: string[][] = [];
        for (const page of source.getPages(lang)) {
          if (!fallbackOrigin(source, this.i18nConfig, page))
            staticPaths.push(imageSegments(page.slugs));
        }

        routes.push({
          path: this.localizePath(lang, `${basePath(this)}/[...slugs]`),
          staticPaths,
          GET: async (_request, { params }) => {
            const page =
              Array.isArray(params.slugs) &&
              (await this.getLoader()).getPage(pageSlugs(params.slugs), lang);
            if (!page) return new Response(null, { status: 404 });

            return api.render(await (options.getImage ?? defaultImage).call(this, page));
          },
        });
      }

      return routes;
    },
    deriveRoutes({ routes }) {
      const out: ApiRoute[] = [];
      for (const route of routes) {
        const image = route.options.ogImage;
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
            path: routeImagePath(this, route, route.path),
            render: "dynamic",
            GET: (_, { params }) => render(params),
          });
          continue;
        }
        for (const { path, params } of route.pages)
          out.push({
            path: routeImagePath(this, route, path),
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
