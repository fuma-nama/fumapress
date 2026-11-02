import { describe, expect, it, vi } from "vitest";

// `waku/router/server` needs the `react-server` condition, which this environment doesn't enable
vi.mock("waku/router/server", () => ({
  unstable_notFound: () => {
    throw new Error("not found");
  },
}));

import { appContext, type AppContext } from "@/app/context";
import type { PressRoute, RouteFns } from "@/lib/types";
import { llmsPlugin, type LLMsOptions } from "@/plugins/llms.txt";
import { asMarkdown } from "@/markdown";
import type { RouteHandler } from "fumadocs-core/framework/plugin";
import { createApp } from "./fixtures";

/** the handlers of the routes of the plugin, then of the ones it derives from `routes` */
async function createRoutes(ctx: AppContext, options: LLMsOptions = {}, routes: PressRoute[] = []) {
  const handlers = new Map<string, RouteHandler>();
  const plugin = llmsPlugin(options);
  for (const route of (await plugin.routes!.call(ctx)) ?? []) handlers.set(route.path, route.GET!);

  const register = (config: { path: string; handler: RouteHandler }) => {
    handlers.set(config.path, config.handler);
  };
  await appContext.run(ctx, async () => {
    await plugin.configureRoutes?.call(ctx, {
      createApi: register,
      createApiIsomorphic: register,
      getRoutes: () => routes,
    } as unknown as RouteFns);
  });
  return { plugin, handlers };
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
  it("derives Markdown routes from the pages of createPage()", async () => {
    const ctx = await createApp();
    const { handlers } = await createRoutes(ctx, { routes: "all" }, [
      route("/about"),
      { ...route("/plain"), component: () => null },
      route("/posts/[slug]", "dynamic"),
    ]);

    expect(Array.from(handlers.keys())).toEqual(
      expect.arrayContaining([
        "/llms.txt",
        "/llms-full.txt",
        "/docs/basics.md",
        "/about.md",
        "/_llms.txt/posts/[slug]",
      ]),
    );
    expect(handlers.has("/plain.md")).toBe(false);
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

  it("serves the Markdown of dynamic pages from their mirror route", async () => {
    const ctx = await createApp();
    const { plugin } = await createRoutes(ctx, { routes: "all" });
    const requested: (string | undefined)[] = [];

    const res = await plugin.middleware!.call(
      ctx,
      new Request("https://example.com/posts/hello.md"),
      async (rewrite) => {
        requested.push(rewrite);
        return rewrite
          ? new Response("# hello", { headers: { "Content-Type": "text/markdown" } })
          : new Response("not found", { status: 404 });
      },
    );

    expect(requested).toEqual([undefined, "/_llms.txt/posts/hello"]);
    expect(await res.text()).toBe("# hello");
  });
});
