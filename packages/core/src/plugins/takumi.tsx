import type { Awaitable, ServerPlugin } from "@/lib/types";
import { unstable_notFound } from "waku/router/server";
import type { ReactNode } from "react";
import type { ConfigContext } from "@/config";
import type { AppContext } from "@/lib/shared";
import { ImageResponse, type ImageResponseOptions } from "@takumi-rs/image-response";
import { joinPathname } from "@/lib/join-pathname";

export interface TakumiOptions<C extends ConfigContext = ConfigContext> {
  /**
   * The base route for generated images.
   *
   * By default, it is `/` (static mode) or `/_takumi` (dynamic mode).
   */
  basePath?: string;
  /** @default 1200 */
  width?: number;
  /** @default 630 */
  height?: number;

  generate?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<{
    node: ReactNode;
    options?: Partial<ImageResponseOptions>;
  }>;
}

export function takumiPlugin<C extends ConfigContext = ConfigContext>(
  options: TakumiOptions<NoInfer<C>> = {},
): ServerPlugin<C> {
  const {
    width = 1200,
    height = 630,
    generate = async function generateDefault(page) {
      const { generate } = await import("fumadocs-ui/og/takumi");

      return {
        node: generate({
          title: page.data.title,
          description: page.data.description,
          site: this.siteConfig.name,
        }),
      };
    },
  } = options;
  let basePath: string;

  function slugsToImagePath(slugs: string[], lang: string | undefined) {
    const segments = [...slugs];
    if (segments.length === 0) {
      segments.push("index.webp");
    } else {
      segments[segments.length - 1] += ".webp";
    }

    return {
      staticPath: lang ? [lang, ...segments] : segments,
      pathname: joinPathname(lang ?? "", basePath, ...segments),
    };
  }

  function imagePathToSlugs(segs: string[]) {
    if (segs.length === 0) return segs;

    const slugs = [...segs];
    slugs[slugs.length - 1] = slugs[slugs.length - 1]!.replace(/\.webp$/, "");
    if (slugs.length === 1 && slugs[0] === "index") slugs.pop();

    return slugs;
  }

  return {
    name: "core:takumi",
    init() {
      const renderMode = this.mode === "default" ? "static" : this.mode;
      basePath = options.basePath ?? (renderMode === "dynamic" ? "/_takumi" : "/");

      const hooks = (this.data["core:page-meta"] ??= []);
      hooks.push((page) => {
        const pathname = slugsToImagePath(page.slugs, page.locale).pathname;

        return (
          <>
            <meta
              property="og:image"
              content={
                this.siteConfig.baseUrl ? new URL(pathname, this.siteConfig.baseUrl).href : pathname
              }
            />
            <meta property="og:image:width" content={`${width}`} />
            <meta property="og:image:height" content={`${height}`} />
            <meta property="twitter:card" content="summary_large_image" />
          </>
        );
      });
    },
    async createPages({ createApiIsomorphic }) {
      const renderMode = this.mode === "default" ? "static" : this.mode;

      createApiIsomorphic({
        render: renderMode,
        path: joinPathname(this.i18nConfig ? "[lang]" : "", basePath, "[...slugs]"),
        staticPaths:
          renderMode === "static"
            ? (await this.getLoader())
                .getPages()
                .map((page) => slugsToImagePath(page.slugs, page.locale).staticPath)
            : undefined,
        handler: async (_, { params }) => {
          const source = await this.getLoader();
          const page = source.getPage(
            imagePathToSlugs(params.slugs as string[]),
            params.lang as string,
          );
          if (!page) unstable_notFound();

          const { node, options } = await generate.call(this, page);
          return new ImageResponse(node, {
            width,
            height,
            ...options,
            format: "webp",
          });
        },
      });
    },
  };
}
