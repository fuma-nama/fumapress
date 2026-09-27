import { describe, expect, it, vi } from "vitest";

// `waku/router/server` needs the `react-server` condition, which this environment doesn't enable
vi.mock("waku/router/server", () => ({
  unstable_notFound: () => {
    throw new Error("not found");
  },
}));

// `LLMs.index` became async in fumadocs-core 16.15.11, the installed version may still be sync
vi.mock("fumadocs-core/source/llms", async (importOriginal) => {
  const mod = await importOriginal<typeof import("fumadocs-core/source/llms")>();

  return {
    ...mod,
    llms: (...args: Parameters<typeof mod.llms>) => {
      const instance = mod.llms(...args);
      return { ...instance, index: async (lang?: string) => instance.index(lang) };
    },
  };
});

import { appContext, type AppContext } from "@/app/context";
import type { PressRoute, RouteFns } from "@/lib/types";
import { llmsPlugin, type LLMsOptions } from "@/plugins/llms.txt";
import { asMarkdown } from "@/markdown";
import { createApp } from "./fixtures";

type ApiConfig = Parameters<RouteFns["createApiIsomorphic"]>[0];

async function createRoutes(ctx: AppContext, options: LLMsOptions = {}, routes: PressRoute[] = []) {
  const handlers = new Map<string, ApiConfig["handler"]>();
  const plugin = llmsPlugin(options);
  const register = (config: ApiConfig) => {
    handlers.set(config.path, config.handler);
  };
  const fns = {
    createApi: register,
    createApiIsomorphic: register,
    getRoutes: () => routes,
  } as unknown as RouteFns;

  await appContext.run(ctx, async () => {
    await plugin.createPages!.call(ctx, fns);
    await plugin.configureRoutes!.call(ctx, fns);
  });
  return handlers;
}

function route(path: string, render: PressRoute["render"] = "static"): PressRoute {
  return {
    render,
    path,
    component: ({ path }: { path: string }) => (asMarkdown() ? `# ${path}` : null),
    meta: [],
    pages: render === "static" ? [{ path, params: {}, translations: [] }] : [],
  };
}

describe("llmsPlugin", () => {
  it("awaits the generated index", async () => {
    const ctx = await createApp();
    const handlers = await createRoutes(ctx);

    const res = await appContext.run(ctx, () =>
      handlers.get("/llms.txt")!(new Request("https://example.com/llms.txt"), { params: {} }),
    );
    const txt = await res.text();

    expect(txt).not.toContain("[object Promise]");
    expect(txt).toContain("/docs/basics");
  });

  it("derives Markdown routes from the pages of createPage()", async () => {
    const ctx = await createApp();
    const handlers = await createRoutes(ctx, { routes: "all" }, [
      route("/about"),
      { ...route("/plain"), component: () => null },
      route("/posts/[slug]", "dynamic"),
    ]);

    expect(Array.from(handlers.keys())).toEqual([
      "/llms.txt",
      "/llms-full.txt",
      "/[...slugs]",
      "/about.md",
      "/_llms.txt/posts/[slug]",
    ]);
    const about = await handlers.get("/about.md")!(new Request("https://example.com/about.md"), {
      params: {},
    });
    expect(await about.text()).toBe("# /about");

    const post = await appContext.run(ctx, () =>
      handlers.get("/_llms.txt/posts/[slug]")!(
        new Request("https://example.com/docs/_llms.txt/posts/hello"),
        { params: { slug: "hello" } },
      ),
    );
    expect(await post.text()).toBe("# /posts/hello");
  });
});
