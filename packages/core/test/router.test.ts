import { describe, expect, it, vi } from "vitest";
import { createElement, type FC, type ReactNode } from "react";
import { defineConfig } from "@/config";
import { createRouter } from "@/router";
import { fsRouterFn } from "@/router/fs";
import type { AppContext } from "@/app/context";
import type { ConfigUtils } from "@/config";
import type { RouteFns } from "@/lib/types";
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

describe("createRouter", () => {
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

  it("rejects hideLocale: always", async () => {
    await expect(
      createRouter(config({ ...prefixed, hideLocale: "always" }) as ConfigUtils),
    ).rejects.toThrow('hideLocale: "always"');
  });
});

describe("fsRouterFn", () => {
  const Page: FC<{ lang?: string }> = ({ lang }) => createElement("p", null, lang);
  const Layout: FC<{ lang?: string; children?: ReactNode }> = ({ lang, children }) =>
    createElement("div", { lang }, children);

  const modules = {
    "./pages/_layout.tsx": async () => ({ default: Layout }),
    "./pages/about.tsx": async () => ({ default: Page }),
    "./pages/legal.tsx": async () => ({ default: Page, getConfig: () => ({ autoI18n: false }) }),
    "./pages/tags/[tag].tsx": async () => ({
      default: Page,
      getConfig: () => ({ staticPaths: ["react"] }),
    }),
  };

  async function routes(i18nConfig: I18nConfig | undefined) {
    await fsRouterFn(modules).call(
      { mode: "static", i18nConfig } as unknown as AppContext,
      recorded.fns(),
    );
  }

  async function lang(path: string) {
    const element = (await render(route(path), {})) as { props: { children?: string } };
    return element.props.children;
  }

  it("registers pages once without i18n", async () => {
    await routes(undefined);

    expect(paths("layout")).toEqual(["/(fs)"]);
    expect(paths("page")).toEqual(["/(fs)/about", "/(fs)/legal", "/(fs)/tags/[tag]"]);
    expect(route("/(fs)/about").component).toBe(Page);
  });

  it("registers a copy per language with the lang prop", async () => {
    await routes(prefixed);

    expect(paths("layout")).toEqual(["/cn/(fs)", "/en/(fs)"]);
    expect(paths("page")).toEqual([
      "/(default)/(fs)/legal",
      "/cn/(fs)/about",
      "/cn/(fs)/tags/[tag]",
      "/en/(fs)/about",
      "/en/(fs)/tags/[tag]",
    ]);
    expect(route("/cn/(fs)/tags/[tag]").staticPaths).toEqual(["react"]);
    expect(await lang("/cn/(fs)/about")).toBe("cn");
    expect(await lang("/en/(fs)/about")).toBe("en");
    expect(route("/(default)/(fs)/legal").component).toBe(Page);
  });

  it("puts the hidden default language in the default group", async () => {
    await routes(hidden);

    expect(paths("layout")).toEqual(["/(default)/(fs)", "/cn/(fs)"]);
    expect(paths("page")).toEqual([
      "/(default)/(fs)/about",
      "/(default)/(fs)/legal",
      "/(default)/(fs)/tags/[tag]",
      "/cn/(fs)/about",
      "/cn/(fs)/tags/[tag]",
    ]);
    expect(await lang("/(default)/(fs)/about")).toBe("en");
  });
});
