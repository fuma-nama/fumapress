import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppContext } from "fumapress";
import { mintlifyPlugin } from "@/index";

const fixturesRoot = path.join(import.meta.dirname, "fixtures");

function createContext(): AppContext {
  return {
    $context: undefined as never,
    mode: "default",
    getLoader: () => {
      throw new Error("not implemented");
    },
    revalidateLoader: () => Promise.resolve(),
    invalidateLoader: () => undefined,
    plugins: [],
    adapters: [],
    layouts: {
      root: () => null,
      page: () => null,
      notFound: () => null,
    },
    data: {},
    siteConfig: { name: "Test" },
  } as unknown as AppContext;
}

describe("mintlifyPlugin", () => {
  it("wires docs.json features into the app context", async () => {
    const ctx = createContext();
    const plugin = mintlifyPlugin({ path: "docs.json", root: fixturesRoot });

    await plugin.init?.call(ctx);

    // head injection
    expect(ctx.metaConfig?.root).toBeTypeOf("function");
    // appearance + search + banner/footer provider hooks
    expect(ctx.data["core:provider"]?.length).toBeGreaterThanOrEqual(3);
    // navigation renderers for docs & notebook layouts
    expect(ctx.data["core:docs-layout"]?.renderers).toHaveLength(1);
    expect(ctx.data["core:notebook-layout"]?.renderers).toHaveLength(1);
    // custom 404
    expect(ctx.layouts.notFound.name).toContain("MintlifyNotFound");
    // navbar defaults
    const props = await ctx.layouts.defaultProps?.call(ctx, { lang: undefined });
    expect(props?.links?.length).toBeGreaterThanOrEqual(3);
    expect(props?.themeSwitch).toEqual({ enabled: false });

    // redirects middleware
    const middlewares = await plugin.createMiddlewares?.call(ctx, { app: null as never });
    expect(middlewares).toHaveLength(1);
  });

  it("allows disabling features", async () => {
    const ctx = createContext();
    const plugin = mintlifyPlugin({
      path: "docs.json",
      root: fixturesRoot,
      features: {
        theme: false,
        navbar: false,
        notFound: false,
        redirects: false,
        appearance: false,
        search: false,
        banner: false,
        footer: false,
      },
    });

    const notFound = ctx.layouts.notFound;
    await plugin.init?.call(ctx);

    expect(ctx.metaConfig).toBeUndefined();
    expect(ctx.layouts.defaultProps).toBeUndefined();
    expect(ctx.layouts.notFound).toBe(notFound);
    expect(ctx.data["core:provider"] ?? []).toHaveLength(0);
    expect(await plugin.createMiddlewares?.call(ctx, { app: null as never })).toBeUndefined();
  });
});
