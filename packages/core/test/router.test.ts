import { describe, expect, it, vi } from "vitest";
import { createElement, type FC, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { defineConfig } from "@/config";
import { createRouter } from "@/router";
import { fsRouterFn } from "@/router/fs";
import type { ConfigUtils } from "@/config";
import type { PressRoute, RouteFns } from "@/lib/types";
import type { I18nConfig } from "fumadocs-core/i18n";
import type { HandlerInterceptor } from "waku/router/server";

interface Route {
  kind: string;
  path?: string;
  render?: string;
  staticPaths?: unknown;
  component: FC<never>;
}

const recorded = vi.hoisted(() => {
  const state = {
    routes: [] as Route[],
    pending: undefined as Promise<unknown> | undefined,
    interceptor: undefined as HandlerInterceptor | undefined,
  };

  return Object.assign(state, {
    fns() {
      state.routes = [];
      const record = (kind: string) => (item: Route) => {
        state.routes.push({ ...item, kind });
        return item;
      };

      return {
        createPage: record("page"),
        createLayout: record("layout"),
        createRoot: record("root"),
        createApi: record("api"),
        createSlice: record("slice"),
        createInterceptor(fn: HandlerInterceptor) {
          state.interceptor = fn;
        },
      } as unknown as RouteFns;
    },
  });
});

vi.mock("waku", () => ({
  createPages(fn: (fns: RouteFns) => Promise<unknown>) {
    recorded.pending = fn(recorded.fns());
    return {};
  },
}));

vi.mock("waku/router/server", () => ({
  unstable_notFound() {
    throw new Error("not found");
  },
  unstable_redirect(to: string) {
    throw new Error(`redirect:${to}`);
  },
}));

const prefixed: I18nConfig = { languages: ["en", "cn"], defaultLanguage: "en" };
const hidden: I18nConfig = { ...prefixed, hideLocale: "default-locale" };

function paths(kind: string) {
  const out: string[] = [];
  for (const route of recorded.routes) if (route.kind === kind) out.push(route.path!);
  return out.sort();
}

function route(path: string): Route {
  const found = recorded.routes.find((route) => route.path === path);
  if (!found) throw new Error(`missing route ${path}`);
  return found;
}

// routes render inside the interceptor, which provides the press context
async function render(route: Route, props: object): Promise<unknown> {
  const call = async () => (route.component as FC<object>)(props);
  return recorded.interceptor ? recorded.interceptor(call) : call();
}

/** rendered page content, without the page meta the router adds in front of it */
async function content(route: Route, props: object): Promise<unknown> {
  const element = (await render(route, props)) as { props: { children: unknown[] } };
  return element.props.children[1];
}

/** rendered HTML of a route */
function html(route: Route, props: object): Promise<string> {
  return recorded.interceptor!(async () => {
    const stream = await renderToReadableStream(await (route.component as FC<object>)(props));
    await stream.allReady;
    return new Response(stream).text();
  }) as Promise<string>;
}

const Lang: FC<{ lang?: string }> = ({ lang }) => createElement("p", null, lang);
const Path: FC<{ path: string }> = ({ path }) => createElement("p", null, path);

function config(i18n: I18nConfig | undefined, mode: "static" | "default" = "static") {
  return defineConfig({
    mode,
    preset: false,
    site: { baseUrl: "https://example.com" },
    content: {
      files: [
        { type: "page", path: "index.mdx", data: { title: "Home" } },
        { type: "page", path: "index.cn.mdx", data: { title: "首页" } },
        { type: "page", path: "guide.mdx", data: { title: "Guide" } },
      ],
    },
    i18n: i18n as never,
    renderRoot: ({ lang, children }) => createElement("html", { lang }, children),
    renderPage: ({ lang, slugs }) => `${lang}:${slugs.join("/")}`,
    renderNotFound: ({ lang }) => `404:${lang}`,
  });
}

describe("createRouter", () => {
  async function routes(cfg: ReturnType<typeof config>) {
    (await createRouter(cfg as ConfigUtils)).createPages();
    await recorded.pending;
  }

  it("prefixes every language and redirects the root", async () => {
    await routes(config(prefixed));

    expect(paths("layout")).toEqual(["/(default)", "/cn", "/en"]);
    expect(paths("page")).toEqual([
      "/",
      "/(default)/404",
      "/cn/404",
      "/cn/[...slugs]",
      "/en/404",
      "/en/[...slugs]",
    ]);
    expect(route("/en/[...slugs]").staticPaths).toEqual([[], ["guide"]]);
    expect(route("/cn/[...slugs]").staticPaths).toContainEqual([]);
    expect(await content(route("/en/[...slugs]"), { slugs: ["guide"] })).toBe("en:guide");
    expect(await content(route("/cn/[...slugs]"), { slugs: [] })).toBe("cn:");
    await expect(render(route("/cn/[...slugs]"), { slugs: ["missing"] })).rejects.toThrow(
      "not found",
    );
    const notFound = (await render(route("/cn/404"), {})) as { props: { lang: string } };
    expect(notFound.props.lang).toBe("cn");

    const root = route("/");
    expect(root.render).toBe("static");
    const redirect = (await render(root, {})) as { props: { to: string } };
    expect(redirect.props.to).toBe("/en");
  });

  it("redirects the root on the server outside static mode", async () => {
    await routes(config(prefixed, "default"));

    expect(route("/").render).toBe("dynamic");
    await expect(render(route("/"), {})).rejects.toThrow("redirect:/en");
  });

  it("serves the hidden default language without prefix", async () => {
    await routes(config(hidden));

    expect(paths("layout")).toEqual(["/(default)", "/cn"]);
    expect(paths("page")).toEqual([
      "/(default)/404",
      "/(default)/[...slugs]",
      "/cn/404",
      "/cn/[...slugs]",
    ]);
    expect(route("/(default)/[...slugs]").staticPaths).toEqual([[], ["guide"]]);
    expect(await content(route("/(default)/[...slugs]"), { slugs: ["guide"] })).toBe("en:guide");

    const layout = (await render(route("/(default)"), { children: "x" })) as {
      props: { lang: string };
    };
    expect(layout.props.lang).toBe("en");
  });

  it("keeps sites without i18n on a single root", async () => {
    await routes(config(undefined));

    expect(paths("root")).toEqual([undefined]);
    expect(paths("layout")).toEqual([]);
    expect(paths("page")).toEqual(["/404", "/[...slugs]"]);
    expect(await content(route("/[...slugs]"), { slugs: ["guide"] })).toBe("undefined:guide");
  });

  it("advertises the URL of pages from createPage", async () => {
    const cfg = config(undefined).plugins({
      createPages({ createPage }) {
        createPage({
          path: "/(plugin)/changelog",
          component: () => createElement("p", null, "changelog"),
        });
      },
    });
    (await createRouter(cfg as ConfigUtils)).createPages(({ createPage }) => {
      createPage({ path: "/about", component: Path });
    });
    await recorded.pending;

    expect(route("/about").render).toBe("static");
    const about = await html(route("/about"), { path: "/about" });
    expect(about).toContain('<link rel="canonical" href="https://example.com/about"/>');
    expect(about).toContain('<meta property="og:url" content="https://example.com/about"/>');
    expect(about).toContain("<p>/about</p>");
    expect(about).not.toContain("hrefLang");

    const changelog = await html(route("/(plugin)/changelog"), { path: "/changelog" });
    expect(changelog).toContain('<link rel="canonical" href="https://example.com/changelog"/>');
    expect(changelog).toContain("<p>changelog</p>");
  });

  it("registers a copy per language that links its translations", async () => {
    const tags: Record<string, string[]> = { en: ["react", "vue"], cn: ["react"] };
    (await createRouter(config(prefixed) as ConfigUtils)).createPages(({ createPage }) => {
      for (const lang of ["en", "cn"]) {
        createPage({ path: "/(fs)/tags/[tag]", lang, staticPaths: tags[lang], component: Lang });
        createPage({ path: "/(fs)/posts/[slug]", lang, render: "dynamic", component: Lang });
      }
      createPage({ path: "/(fs)/legal", component: Lang });
    });
    await recorded.pending;

    expect(route("/en/(fs)/tags/[tag]").staticPaths).toEqual(["react", "vue"]);
    expect(route("/cn/(fs)/tags/[tag]").staticPaths).toEqual(["react"]);
    const react = await html(route("/cn/(fs)/tags/[tag]"), { path: "/cn/tags/react" });
    expect(react).toContain("<p>cn</p>");
    expect(react).toContain('<link rel="canonical" href="https://example.com/cn/tags/react"/>');
    expect(react).toContain(
      '<link rel="alternate" hrefLang="en" href="https://example.com/en/tags/react"/>',
    );
    expect(react).toContain(
      '<link rel="alternate" hrefLang="cn" href="https://example.com/cn/tags/react"/>',
    );
    expect(react).toContain(
      '<link rel="alternate" hrefLang="x-default" href="https://example.com/en/tags/react"/>',
    );
    // only English lists it
    expect(await html(route("/en/(fs)/tags/[tag]"), { path: "/en/tags/vue" })).not.toContain(
      "hrefLang",
    );
    // the translations of a dynamic page without static paths are unknown
    expect(await html(route("/en/(fs)/posts/[slug]"), { path: "/en/posts/hi" })).not.toContain(
      "hrefLang",
    );

    const legal = await html(route("/(default)/(fs)/legal"), { path: "/legal" });
    expect(legal).toContain('<link rel="canonical" href="https://example.com/legal"/>');
    expect(legal).not.toContain("hrefLang");
    expect(legal).toContain("<p></p>");
  });

  it("links the hidden default language without prefix, decoding dynamic requests", async () => {
    (await createRouter(config(hidden) as ConfigUtils)).createPages(({ createPage }) => {
      for (const lang of ["en", "cn"]) {
        createPage({ path: "/(fs)/tags/[tag]", lang, staticPaths: ["café"], component: Lang });
      }
    });
    await recorded.pending;

    expect(route("/(default)/(fs)/tags/[tag]").staticPaths).toEqual(["café"]);
    const page = await html(route("/cn/(fs)/tags/[tag]"), { path: "/cn/tags/caf%C3%A9" });
    expect(page).toContain('<link rel="canonical" href="https://example.com/cn/tags/caf%C3%A9"/>');
    expect(page).toContain(
      '<link rel="alternate" hrefLang="en" href="https://example.com/tags/caf%C3%A9"/>',
    );
    expect(page).toContain(
      '<link rel="alternate" hrefLang="x-default" href="https://example.com/tags/caf%C3%A9"/>',
    );
  });

  it("lists routes for configureRoutes and renders their meta", async () => {
    let seen: PressRoute[] = [];
    const cfg = config(prefixed).plugins({
      createPages({ createPage }) {
        for (const lang of ["en", "cn"]) {
          createPage({
            path: "/(fs)/tags/[tag]",
            lang,
            staticPaths: lang === "en" ? ["react", "vue"] : ["react"],
            component: Lang,
          });
        }
      },
      configureRoutes({ getRoutes }) {
        seen = getRoutes();
        for (const route of seen) {
          route.meta.push((props) => createElement("meta", { name: "x", content: props.path }));
        }
      },
    });
    (await createRouter(cfg as ConfigUtils)).createPages();
    await recorded.pending;

    expect(seen.map((route) => [route.path, route.lang, route.render])).toEqual([
      ["/en/tags/[tag]", "en", "static"],
      ["/cn/tags/[tag]", "cn", "static"],
    ]);
    expect(seen[0]!.pages).toEqual([
      {
        path: "/en/tags/react",
        params: { tag: "react" },
        translations: [
          { locale: "en", path: "/en/tags/react" },
          { locale: "cn", path: "/cn/tags/react" },
        ],
      },
      {
        path: "/en/tags/vue",
        params: { tag: "vue" },
        translations: [{ locale: "en", path: "/en/tags/vue" }],
      },
    ]);
    expect(await html(route("/en/(fs)/tags/[tag]"), { path: "/en/tags/vue" })).toContain(
      '<meta name="x" content="/en/tags/vue"/>',
    );
  });

  it("rejects hideLocale: always", async () => {
    await expect(
      createRouter(config({ ...prefixed, hideLocale: "always" }) as ConfigUtils),
    ).rejects.toThrow('hideLocale: "always"');
  });
});

describe("fsRouterFn", () => {
  const Layout: FC<{ lang?: string; children?: ReactNode }> = ({ lang, children }) =>
    createElement("div", { lang }, children);

  const modules = {
    "./pages/_layout.tsx": async () => ({ default: Layout }),
    "./pages/about.tsx": async () => ({ default: Lang }),
    "./pages/legal.tsx": async () => ({ default: Lang, getConfig: () => ({ autoI18n: false }) }),
    "./pages/tags/[tag].tsx": async () => ({
      default: Lang,
      getConfig: () => ({ staticPaths: ["react"] }),
    }),
  };

  async function routes(i18n: I18nConfig | undefined) {
    (await createRouter(config(i18n) as ConfigUtils)).createPages(fsRouterFn(modules));
    await recorded.pending;
  }

  /** the routes of the pages directory, next to the ones of the content */
  function fsPaths(kind: string) {
    return paths(kind).filter((path) => path.includes("(fs)"));
  }

  it("registers pages once without i18n", async () => {
    await routes(undefined);

    expect(fsPaths("layout")).toEqual(["/(fs)"]);
    expect(fsPaths("page")).toEqual(["/(fs)/about", "/(fs)/legal", "/(fs)/tags/[tag]"]);
    expect(route("/(fs)/tags/[tag]").staticPaths).toEqual(["react"]);
    expect(await html(route("/(fs)/about"), { path: "/about" })).toContain(
      '<link rel="canonical" href="https://example.com/about"/>',
    );
  });

  it("registers a copy per language with the lang prop", async () => {
    await routes(prefixed);

    expect(fsPaths("layout")).toEqual(["/cn/(fs)", "/en/(fs)"]);
    expect(fsPaths("page")).toEqual([
      "/(default)/(fs)/legal",
      "/cn/(fs)/about",
      "/cn/(fs)/tags/[tag]",
      "/en/(fs)/about",
      "/en/(fs)/tags/[tag]",
    ]);
    expect(route("/cn/(fs)/tags/[tag]").staticPaths).toEqual(["react"]);
    expect(await html(route("/cn/(fs)/about"), { path: "/cn/about" })).toContain("<p>cn</p>");
    expect(await html(route("/(default)/(fs)/legal"), { path: "/legal" })).toContain("<p></p>");
    const layout = (await render(route("/cn/(fs)"), { children: "x" })) as {
      props: { lang: string };
    };
    expect(layout.props.lang).toBe("cn");
  });

  it("puts the hidden default language in the default group", async () => {
    await routes(hidden);

    expect(fsPaths("layout")).toEqual(["/(default)/(fs)", "/cn/(fs)"]);
    expect(fsPaths("page")).toEqual([
      "/(default)/(fs)/about",
      "/(default)/(fs)/legal",
      "/(default)/(fs)/tags/[tag]",
      "/cn/(fs)/about",
      "/cn/(fs)/tags/[tag]",
    ]);
    expect(await html(route("/(default)/(fs)/about"), { path: "/about" })).toContain("<p>en</p>");
  });
});
