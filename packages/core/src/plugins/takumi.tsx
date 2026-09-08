import type { Awaitable } from "@/lib/types";
import type { PressPlugin } from "@/app/plugin";
import type { AppContext, AppShape } from "@/app/context";
import { unstable_notFound } from "waku/router/server";
import type { FC, ReactNode } from "react";
import { ImageResponse, type ImageResponseOptions } from "takumi-js/response";
import { joinPathname } from "@/lib/pathname";
import { inheritedFrom } from "@/lib/i18n";
import { type CreatedPage, expandStaticPath, type RouteParams } from "@/lib/routes";
import { asMarkdown } from "@/markdown";

export { fontFromUrl, googleFonts } from "takumi-js/helpers";

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
  /** @default 1200 */
  width?: number;
  /** @default 630 */
  height?: number;

  /**
   * Options shared by every image, `generate()` overrides them per page.
   *
   * Values resolved once belong here, like the fonts from `googleFonts()`.
   */
  options?: TakumiImageOptions;

  generate?: (
    this: AppContext<C>,
    page: C["page"],
  ) => Awaitable<{
    node: ReactNode;
    options?: TakumiImageOptions;
  }>;
}

/** The image of a route: a `node` to draw, or `title` and `description` for the default template. */
export interface TakumiRouteImage {
  node?: ReactNode;
  title?: string;
  description?: string;
  /** image response options of this route, over the shared `options` */
  options?: TakumiImageOptions;
}

/**
 * The `takumiOptions` of a route config. A function receives the route params of the rendered path
 * (`lang` included for `autoI18n` pages), `this` is the app context.
 */
export type TakumiRouteOptions<C extends AppShape = AppShape> =
  | TakumiRouteImage
  | ((this: AppContext<C>, params: RouteParams) => Awaitable<TakumiRouteImage>);

export function takumiPlugin<C extends AppShape = AppShape>(
  options: TakumiOptions<NoInfer<C>> = {},
): PressPlugin<C> {
  const {
    width = 1200,
    height = 630,
    options: shared,
    generate = function fn(page) {
      return {
        node: generateDefault({
          title: page.data.title,
          description: page.data.description,
          site: this.siteConfig.name,
        }),
      };
    },
  } = options;
  let basePath: string;
  let renderMode: "static" | "dynamic";

  function render(node: ReactNode, options?: TakumiImageOptions) {
    return new ImageResponse(node, {
      width,
      height,
      ...shared,
      ...options,
      format: "webp",
    });
  }

  function slugsToImagePath(slugs: string[]) {
    const segments = [...slugs];
    if (segments.length === 0) {
      segments.push("index.webp");
    } else {
      segments[segments.length - 1] += ".webp";
    }

    return segments;
  }

  function imagePathToSlugs(segs: string[]) {
    if (segs.length === 0) return segs;

    const slugs = [...segs];
    slugs[slugs.length - 1] = slugs[slugs.length - 1]!.replace(/\.webp$/, "");
    if (slugs.length === 1 && slugs[0] === "index") slugs.pop();

    return slugs;
  }

  /** static routes get a `.webp` file next to the page, dynamic ones an image route under `/_takumi` */
  function routeImagePath(pathname: string, dynamic: boolean) {
    if (dynamic) return joinPathname(basePath === "/" ? "/_takumi" : basePath, pathname);
    return joinPathname(basePath, pathname === "/" ? "index.webp" : `${pathname}.webp`);
  }

  function imageMeta(url: string) {
    return (
      <>
        <meta property="og:image" content={url} />
        <meta property="og:image:width" content={`${width}`} />
        <meta property="og:image:height" content={`${height}`} />
        <meta property="twitter:card" content="summary_large_image" />
      </>
    );
  }

  return {
    name: "core:takumi",
    init() {
      renderMode = this.mode === "default" ? "static" : this.mode;
      basePath = options.basePath ?? (renderMode === "dynamic" ? "/_takumi" : "/");

      // fallback pages have no image of their own, point at the source page's
      const PageImage = async ({ page }: { page: C["page"] }) => {
        const origin = inheritedFrom(await this.getLoader(), this.i18nConfig, page);
        return imageMeta(
          this.absoluteUrl(
            this.localizePath(
              (origin ?? page).locale,
              joinPathname(basePath, ...slugsToImagePath(page.slugs)),
            ),
            { file: true },
          ),
        );
      };

      this.interceptPageMeta(({ page, next }) => (
        <>
          {next()}
          <PageImage page={page} />
        </>
      ));
    },
    prepareCreatePages(fns) {
      const { createPage } = fns;
      fns.createPage = (page) => {
        const { takumiOptions: image, ...rest } = page as CreatedPage & {
          takumiOptions?: TakumiRouteOptions<C>;
        };
        if (!image) return createPage(page);

        const renderImage = async (params: RouteParams) => {
          const { node, title, description, options } =
            typeof image === "function" ? await image.call(this, params) : image;

          return render(
            node ?? generateDefault({ title, description, site: this.siteConfig.name }),
            options,
          );
        };
        const dynamic = rest.render === "dynamic";
        const segments = rest.path.split("/").filter(Boolean);

        if (dynamic) {
          const spec: string[] = [];
          for (const seg of segments) if (!seg.startsWith("(")) spec.push(seg);

          fns.createApiIsomorphic({
            render: "dynamic",
            path: routeImagePath("/" + spec.join("/"), true),
            handler: (_, { params }) => renderImage(params),
          });
        } else {
          const entries = segments.some((seg) => seg.startsWith("["))
            ? (rest.staticPaths ?? [])
            : [[]];
          for (const entry of entries) {
            const { pathname, params } = expandStaticPath(
              segments,
              typeof entry === "string" ? [entry] : entry,
            );

            fns.createApiIsomorphic({
              render: "static",
              path: routeImagePath(pathname, false),
              handler: () => renderImage(params),
            });
          }
        }

        const Page = rest.component as FC<{ path: string }>;
        return createPage({
          ...rest,
          // called in place, so the Markdown renderer of llms.txt still sees its `asMarkdown()`
          component: (props: { path: string }) => (
            <>
              {!asMarkdown() &&
                imageMeta(this.absoluteUrl(routeImagePath(props.path, dynamic), { file: true }))}
              {"$$typeof" in Page ? <Page {...props} /> : Page(props)}
            </>
          ),
        } as never);
      };
    },
    async createPages({ createApiIsomorphic }) {
      const staticPathsByLang = new Map<string | undefined, string[][]>();
      const source = await this.getLoader();
      for (const page of source.getPages()) {
        if (inheritedFrom(source, this.i18nConfig, page)) continue;
        const paths = staticPathsByLang.get(page.locale);
        if (paths) paths.push(slugsToImagePath(page.slugs));
        else staticPathsByLang.set(page.locale, [slugsToImagePath(page.slugs)]);
      }

      for (const lang of this.i18nConfig?.languages ?? [undefined]) {
        createApiIsomorphic({
          render: renderMode,
          path: this.localizePath(lang, joinPathname(basePath, "[...slugs]")),
          staticPaths: staticPathsByLang.get(lang) ?? [],
          handler: async (_, { params }) => {
            const source = await this.getLoader();
            const page = source.getPage(imagePathToSlugs(params.slugs as string[]), lang);
            if (!page) unstable_notFound();

            const { node, options } = await generate.call(this, page);
            return render(node, options);
          },
        });
      }
    },
  };
}

function generateDefault({
  site,
  title,
  description,
}: {
  title?: string;
  description?: string;
  site?: string;
}) {
  const primaryColor = "rgba(255,150,255,0.3)";
  const primaryTextColor = "rgb(255,150,255)";
  const icon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-book-icon lucide-book"
    >
      <circle cx="12" cy="12" r="11" stroke={primaryTextColor} strokeWidth="2" />
    </svg>
  );
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
      <p
        style={{
          fontWeight: 800,
          fontSize: "82px",
          margin: 0,
        }}
      >
        {title}
      </p>
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
        {icon}
        {site && (
          <p
            style={{
              fontSize: "56px",
              fontWeight: 600,
              margin: 0,
            }}
          >
            {site}
          </p>
        )}
      </div>
    </div>
  );
}
