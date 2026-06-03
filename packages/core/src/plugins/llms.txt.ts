import { llms } from "fumadocs-core/source/llms";
import type { Awaitable, ServerPlugin } from "@/lib/types";
import type { ConfigContext } from "@/config";
import { unstable_notFound } from "waku/router/server";
import type { AppContext } from "@/lib/shared";
import type { MiddlewareHandler } from "hono";
import { isMarkdownPreferred } from "fumadocs-core/negotiation";
import { joinPathname } from "@/lib/pathname";

export interface LLMsOptions<C extends ConfigContext = ConfigContext> {
  /**
   * When request prefers Markdown response, automatically redirect to the generated Markdown route.
   * Ignored when static mode is enabled.
   *
   * @default true
   */
  autoRedirect?: boolean;

  getLLMText?: (this: AppContext<C>, page: C["page"]) => Awaitable<string | undefined>;
}

export function llmsPlugin<C extends ConfigContext = ConfigContext>(
  options: LLMsOptions<NoInfer<C>> = {},
): ServerPlugin<C> {
  let basePath = "/";
  const {
    autoRedirect = true,
    getLLMText: _getLLMText = async function getLLMTextDefault(page) {
      for (const adapter of this.adapters) {
        const txt = await adapter["core:get-text"]?.call(this, page);

        if (txt !== undefined) {
          return `# ${page.data.title} (${page.url})\n\n${txt}`;
        }
      }
    },
  } = options;

  function markdownPathToSlugs(segs: string[]) {
    if (segs.length === 0) return segs;

    const slugs = [...segs];
    slugs[slugs.length - 1] = slugs[slugs.length - 1]!.replace(/\.md$/, "");
    if (slugs.length === 1 && slugs[0] === "index") slugs.pop();

    return slugs;
  }

  function slugsToMarkdownPath(slugs: string[], lang?: string) {
    const segments = [...slugs];
    if (segments.length === 0) {
      segments.push("index.md");
    } else {
      segments[segments.length - 1] += ".md";
    }

    return {
      staticPath: lang ? [lang, ...segments] : segments,
      pathname: joinPathname(lang ?? "", basePath, ...segments),
    };
  }

  return {
    name: "core:llms.txt",
    init() {
      if (this.mode === "dynamic") {
        basePath = "/_llms.txt";
      }

      this.data["core:docs-layout"] ??= {};
      this.data["core:docs-layout"].renderers ??= [];
      this.data["core:docs-layout"].renderers.push(function (res) {
        res.markdownUrl ??= slugsToMarkdownPath(this.page.slugs, this.page.locale).pathname;
        return res;
      });
    },
    createMiddlewares() {
      if (this.mode === "static") return;
      const middlewares: MiddlewareHandler[] = [];

      const parsePathname = (pathname: string) => {
        const slugs = pathname.split("/").filter((v) => v.length > 0);

        if (this.i18nConfig) {
          return slugs.length > 0 ? { lang: slugs.shift(), slugs } : undefined;
        }

        return { slugs };
      };

      if (autoRedirect) {
        middlewares.push(async ({ req, redirect }, next) => {
          if (req.path.endsWith(".md") || !isMarkdownPreferred(req.raw)) return next();

          const parsed = parsePathname(req.path);
          if (!parsed) return next();
          const { lang, slugs } = parsed;

          const loader = await this.getLoader();
          if (!loader.getPage(slugs, lang)) return next();

          return redirect(slugsToMarkdownPath(slugs, lang).pathname);
        });
      }

      // API route is created under _llms.txt with force dynamic, this redirects requests like "/page.md" back to "/_llms.txt/page.md"
      if (this.mode === "dynamic") {
        middlewares.push(async ({ req, redirect }, next) => {
          if (!req.path.endsWith(".md")) return next();

          const parsed = parsePathname(req.path);
          if (!parsed || parsed.slugs[0] === "_llms.txt") return next();
          const { lang, slugs } = parsed;

          const loader = await this.getLoader();
          slugs[slugs.length - 1] = slugs[slugs.length - 1]!.replace(/\.md$/, "");
          if (!loader.getPage(slugs, lang)) return next();

          return redirect(slugsToMarkdownPath(slugs, lang).pathname);
        });
      }

      return middlewares;
    },
    async createPages({ createApiIsomorphic }) {
      const renderMode = this.mode === "default" ? "static" : this.mode;
      const getLLMText = _getLLMText.bind(this);

      createApiIsomorphic({
        render: renderMode,
        path: "/llms.txt",
        handler: async () => {
          const source = await this.getLoader();
          return new Response(llms(source).index());
        },
      });

      createApiIsomorphic({
        render: renderMode,
        path: "/llms-full.txt",
        handler: async () => {
          const source = await this.getLoader();
          const scanned = await Promise.all(source.getPages().map(getLLMText));

          return new Response(scanned.filter((item) => item !== undefined).join("\n\n"));
        },
      });

      createApiIsomorphic({
        render: renderMode,
        path: joinPathname(this.i18nConfig ? "[lang]" : "", basePath, "[...slugs]"),
        staticPaths: (await this.getLoader())
          .getPages()
          .map((page) => slugsToMarkdownPath(page.slugs, page.locale).staticPath),
        handler: async (_req, { params }) => {
          const source = await this.getLoader();
          const page = source.getPage(
            markdownPathToSlugs(params.slugs as string[]),
            params.lang as string,
          );
          if (!page) unstable_notFound();
          const txt = await getLLMText(page);

          return new Response(txt ?? "", {
            headers: {
              "Content-Type": "text/markdown",
            },
          });
        },
      });
    },
  };
}
