import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppContext } from "fumapress";
import { mintlifyPlugin } from "@/index";

const fixturesRoot = path.join(import.meta.dirname, "fixtures");

function createContext(): AppContext {
  const rootMetaInterceptors: ((opts: { next: () => unknown }) => unknown)[] = [];
  let defaultLayoutProps = async () => ({});
  let renderNotFound = () => null;

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
    data: {},
    siteConfig: { name: "Test" },
    get defaultLayoutProps() {
      return defaultLayoutProps;
    },
    set defaultLayoutProps(value) {
      defaultLayoutProps = value;
    },
    get renderNotFound() {
      return renderNotFound;
    },
    set renderNotFound(value) {
      renderNotFound = value;
    },
    interceptRootMeta(interceptor: (opts: { next: () => unknown }) => unknown) {
      rootMetaInterceptors.push(interceptor);
    },
    interceptPageMeta() {},
    renderRootMeta() {
      return rootMetaInterceptors[0]?.({ next: () => null }) ?? null;
    },
    renderPageMeta() {
      return null;
    },
  } as unknown as AppContext;
}

describe("mintlifyPlugin", () => {
  it("wires docs.json features into the app context", async () => {
    const ctx = createContext();
    const plugin = mintlifyPlugin({ path: "docs.json", root: fixturesRoot });

    await plugin.init?.call(ctx);

    // head injection
    expect(ctx.renderRootMeta()).not.toBeNull();
    // appearance + search + banner/footer provider hooks
    expect(ctx.data["core:provider"]?.length).toBeGreaterThanOrEqual(3);
    // navigation transformers for docs & notebook layouts
    expect(ctx.data["core:docs-layout"]?.transformers).toHaveLength(1);
    expect(ctx.data["core:notebook-layout"]?.transformers).toHaveLength(1);
    // custom 404
    expect(ctx.renderNotFound.name).toContain("MintlifyNotFound");
    // navbar defaults
    const props = await ctx.defaultLayoutProps();
    expect(props?.links?.length).toBeGreaterThanOrEqual(3);
    expect(props?.themeSwitch).toEqual({ enabled: false });

    // redirects middleware
    const middlewares = await plugin.createMiddlewares?.call(ctx, { app: null as never });
    expect(middlewares).toHaveLength(1);
  });

  it("respects feature toggles", async () => {
    const ctx = createContext();
    const notFound = ctx.renderNotFound;
    const plugin = mintlifyPlugin({
      path: "docs.json",
      root: fixturesRoot,
      features: {
        theme: false,
        navbar: false,
        notFound: false,
        redirects: false,
        navigation: false,
        appearance: false,
        banner: false,
        footer: false,
        search: false,
        metadata: false,
      },
    });

    await plugin.init?.call(ctx);

    expect(ctx.renderRootMeta()).toBeNull();
    expect(ctx.data["core:docs-layout"]?.transformers).toBeUndefined();
    expect(ctx.renderNotFound).toBe(notFound);
    expect(await plugin.createMiddlewares?.call(ctx, { app: null as never })).toBeUndefined();
  });
});
