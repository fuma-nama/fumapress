import { describe, expect, it } from "vitest";
import { createElement, type FC, type ReactNode } from "react";
import type { AppContext, RouteFns } from "fumapress";
import { changelogPlugin } from "../src/plugin.tsx";

interface Route {
  kind: string;
  path: string;
  staticPaths?: unknown;
  component: FC<never>;
}

const prefixed = { languages: ["en", "cn"], defaultLanguage: "en" };
const hidden = { ...prefixed, hideLocale: "default-locale" } as const;

function record() {
  const routes: Route[] = [];
  const of = (kind: string) => (item: Route) => void routes.push({ ...item, kind });

  return {
    routes,
    fns: {
      createPage: of("page"),
      createLayout: of("layout"),
      createInterceptor: () => {},
    } as unknown as RouteFns,
  };
}

// stubs, the real layouts need the server context of createRouter()
const Layout: FC<{ lang?: string; children: ReactNode }> = ({ lang, children }) =>
  createElement("div", { lang }, children);
const IndexPage: FC<{ lang?: string }> = ({ lang }) => createElement("p", { lang });

async function routes(i18nConfig: unknown) {
  const { routes, fns } = record();
  const plugin = changelogPlugin({ layouts: { layout: Layout, index: IndexPage } });
  await plugin.createPages!.call({ mode: "static", i18nConfig } as AppContext, fns);
  return routes;
}

const paths = (routes: Route[], kind: string) =>
  routes
    .filter((route) => route.kind === kind)
    .map((route) => route.path)
    .sort();

describe("changelogPlugin", () => {
  it("registers once without i18n", async () => {
    const out = await routes(undefined);

    expect(paths(out, "layout")).toEqual(["/(changelog)"]);
    expect(paths(out, "page")).toEqual(["/(changelog)/changelog"]);
  });

  it("registers a copy per language under its prefix", async () => {
    const out = await routes(prefixed);

    expect(paths(out, "layout")).toEqual(["/cn/(changelog)", "/en/(changelog)"]);
    expect(paths(out, "page")).toEqual(["/cn/(changelog)/changelog", "/en/(changelog)/changelog"]);
  });

  it("puts the hidden default language in the default group", async () => {
    const out = await routes(hidden);

    expect(paths(out, "layout")).toEqual(["/(default)/(changelog)", "/cn/(changelog)"]);
    expect(paths(out, "page")).toEqual([
      "/(default)/(changelog)/changelog",
      "/cn/(changelog)/changelog",
    ]);
  });

  it("fixes the lang prop of every route component", async () => {
    const out = await routes(hidden);
    const lang = (path: string) => {
      const route = out.find((item) => item.path === path)!;
      const rendered = (route.component as FC<object>)({}) as { props: { lang?: string } };
      return rendered.props.lang;
    };

    expect(lang("/cn/(changelog)")).toBe("cn");
    expect(lang("/(default)/(changelog)/changelog")).toBe("en");
  });
});
