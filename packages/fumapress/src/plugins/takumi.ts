import { renderHeadTags, type AppContext, type AppShape } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";
import { joinPaths } from "@/lib/pathname";
import type { Awaitable } from "@/lib/types";
import * as Press from "@fumapress/core/plugins/takumi";
import type { HeadTag, RouteParams } from "fumadocs-core/framework/plugin";

export { fontFromUrl, googleFonts } from "takumi-js/helpers";
export type {
  TakumiAPI,
  TakumiImage,
  TakumiImageOptions,
  TakumiOptions,
} from "@fumapress/core/plugins/takumi";

/** The image of a route: a `node` to draw, or `title` and `description` for the default template. */
export interface TakumiRouteImage extends Partial<Press.TakumiImage> {
  title?: string;
  description?: string;
}

/**
 * The `takumiOptions` of a route config. A function receives the route params of the rendered path
 * (`lang` included for `autoI18n` pages), `this` is the app context.
 */
export type TakumiRouteOptions<C extends AppShape = AppShape> =
  | TakumiRouteImage
  | ((this: AppContext<C>, params: RouteParams) => Awaitable<TakumiRouteImage>);

/**
 * Open Graph images of content pages with Takumi, requires `takumi-js` and `fumadocs-ui`.
 *
 * Pages of `createPage()` with `takumiOptions` get one too: prerendered for static pages, rendered on request for dynamic pages.
 */
export function takumiPlugin<C extends AppShape = AppShape>(
  options: Press.TakumiOptions<NoInfer<C>> = {},
): PressPlugin<C> {
  const plugin = Press.takumiPlugin<C>(options);
  const api = plugin.api as Press.TakumiAPI;

  return {
    ...plugin,
    configureRoutes({ createApiIsomorphic, getRoutes }) {
      for (const route of getRoutes()) {
        const image = route.takumiOptions as TakumiRouteOptions<C> | undefined;
        if (!image) continue;

        const renderImage = async (params: RouteParams) => {
          const { node, title, description, options } =
            typeof image === "function" ? await image.call(this, params) : image;

          return api.render({
            node: node ?? Press.generate({ title, description, site: this.siteConfig.name }),
            options,
          });
        };
        const dynamic = route.render === "dynamic";
        // a static page gets a file, a dynamic page an image route with its params
        const imagePath = (pathname: string) =>
          dynamic
            ? joinPaths("/", api.basePath, pathname)
            : joinPaths("/", api.basePath, pathname === "/" ? "index.webp" : `${pathname}.webp`);

        if (dynamic) {
          createApiIsomorphic({
            render: "dynamic",
            path: imagePath(route.path),
            handler: (_, { params }) => renderImage(params),
          });
        } else {
          for (const { path, params } of route.pages) {
            createApiIsomorphic({
              render: "static",
              path: imagePath(path),
              handler: () => renderImage(params),
            });
          }
        }

        route.meta.push((props) =>
          renderHeadTags(imageTags(this.absoluteUrl(imagePath(props.path)), api)),
        );
      }
    },
  };
}

/** the tags of the image at `url`, like the ones of content pages */
function imageTags(url: string, { width, height }: Press.TakumiAPI): HeadTag[] {
  return [
    { tag: "meta", attrs: { property: "og:image", content: url } },
    { tag: "meta", attrs: { property: "og:image:width", content: String(width) } },
    { tag: "meta", attrs: { property: "og:image:height", content: String(height) } },
    { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
    { tag: "meta", attrs: { name: "twitter:image", content: url } },
  ];
}
