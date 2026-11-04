import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Context, DocsPageData, ViewRoute } from "@fumapress/core";
import type { Root } from "fumadocs-core/page-tree";
import type { LoaderPlugin } from "fumadocs-core/source";
import { notFoundView } from "@/features/not-found";
import { mintlifyPlugin, type MintlifyPluginOptions } from "@/index";
import { page } from "./fixtures/page-tree";

const fixturesRoot = path.join(import.meta.dirname, "fixtures");

/** the members of a context the plugin uses, the home page is `/` */
/** views of this plugin are static, the request is unused */
const env = { lang: undefined, request: new Request("https://example.com/404") };

const ctx = {
  mode: "default",
  languages: [undefined],
  withBase: (pathname: string) => (pathname === "/" ? "/base" : `/base${pathname}`),
  localizePath: (_lang: string | undefined, pathname: string) => pathname,
  getLoader: async () => ({ getPageByUrl: () => ({}) }),
} as unknown as Context;

async function setup(options: Omit<MintlifyPluginOptions, "path" | "root"> = {}) {
  const plugin = mintlifyPlugin({ path: "docs.json", root: fixturesRoot, ...options });
  await plugin.init?.call(ctx);
  return { ctx, plugin };
}

const off = {
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
};

describe("mintlifyPlugin", () => {
  it("adds head tags of every page and noindex to pages outside the navigation", async () => {
    const { ctx, plugin } = await setup();

    const tags = (await plugin.head?.call(ctx, {})) ?? [];
    expect(tags[0]?.tag).toBe("style");
    expect(tags).toContainEqual({
      tag: "script",
      attrs: expect.objectContaining({ async: "async" }),
    });
    expect(tags).toContainEqual({
      tag: "meta",
      attrs: { property: "og:site_name", content: "Full Docs" },
    });

    const quickstart = { url: "/quickstart", path: "quickstart.mdx", slugs: ["quickstart"] };
    const hidden = { url: "/hidden", path: "hidden.mdx", slugs: ["hidden"] };
    expect(await plugin.head?.call(ctx, { page: quickstart as never })).toBeUndefined();
    expect(await plugin.head?.call(ctx, { page: hidden as never })).toEqual([
      { tag: "meta", attrs: { name: "robots", content: "noindex" } },
    ]);
  });

  it("builds the page tree from the navigation", async () => {
    const { ctx, plugin } = await setup();
    const options = await plugin.configureLoader?.call(ctx, { baseUrl: "/" });
    const [loaderPlugin] = (options?.plugins ?? []) as LoaderPlugin[];

    const root: Root = {
      $id: "root",
      name: "Docs",
      children: [page("index.mdx", "Home"), page("quickstart.mdx", "Quickstart")],
    };
    const tree = loaderPlugin?.transformPageTree?.root?.call({ locale: undefined } as never, root);

    expect(tree?.name).toBe("Full Docs");
    expect(tree?.children).toMatchObject([
      {
        type: "folder",
        name: "Docs",
        icon: expect.anything(),
        children: [{ type: "folder", children: [{ name: "Home" }, { name: "Quickstart" }] }],
      },
    ]);
  });

  it("contributes navbar and provider props", async () => {
    const { ctx, plugin } = await setup();

    const options = await plugin.baseOptions?.call(ctx, { lang: undefined });
    expect(options?.links?.length).toBeGreaterThanOrEqual(3);
    expect(options?.nav?.title).toBeDefined();
    expect(options?.themeSwitch).toEqual({ enabled: false });

    const provider = await plugin.providerProps?.call(ctx, { lang: undefined });
    expect(provider?.theme).toEqual({ defaultTheme: "dark", forcedTheme: "dark" });
    expect(provider?.i18n?.translations?.["Search(search trigger)"]).toBe("Search the docs...");
  });

  it("wraps layouts with the banner and footer", async () => {
    const { ctx, plugin } = await setup();

    const [item] = (await plugin.slots?.call(ctx, {})) ?? [];
    expect(item?.slot).toBe("layout.wrapper");
    expect(Object.keys(item?.props ?? {})).toEqual(["banner", "footer"]);
    expect(await plugin.slots?.call(ctx, { page: page("index.mdx") as never })).toBeUndefined();
  });

  it("keeps timestamps with `metadata.timestamp`", async () => {
    const { ctx, plugin } = await setup();
    const data = await plugin.transformPage?.call(
      ctx,
      { lastModified: new Date() } as DocsPageData,
      undefined as never,
    );

    expect(data).toBeUndefined();
  });

  it("redirects requests", async () => {
    const { ctx, plugin } = await setup();
    const next = vi.fn(async () => new Response("page"));

    const response = await plugin.middleware?.call(
      ctx,
      new Request("https://example.com/base/old/a/b"),
      next,
    );
    expect(response?.status).toBe(307);
    expect(response?.headers.get("Location")).toBe("/base/new/a/b");

    await plugin.middleware?.call(ctx, new Request("https://example.com/base/other"), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("adds the 404 page as a view", async () => {
    const { ctx, plugin } = await setup();

    const createView = vi.fn();
    await plugin.routes?.call(ctx, { createApi: vi.fn(), createView });
    const route: ViewRoute | undefined = createView.mock.calls[0]?.[0];
    expect(route?.path).toBe("/404");
    const view = await route?.view({}, env);
    expect(view?.props).toEqual({ title: "Not found", description: "Try **searching**." });
    expect(view?.node).toMatchObject({ type: "div" });
  });

  it("redirects the 404 page home by default", async () => {
    const view = await notFoundView(ctx, {})?.view({}, env);
    expect(view?.props.title).toBe("Page not found");
    expect(JSON.stringify(view?.node)).toContain("0;url=/base");
    expect(notFoundView(ctx, { 404: { redirect: false } })).toBeUndefined();
  });

  it("respects feature toggles", async () => {
    const { ctx, plugin } = await setup({ features: off });

    expect(await plugin.head?.call(ctx, {})).toBeUndefined();
    expect(await plugin.slots?.call(ctx, {})).toBeUndefined();
    expect(await plugin.configureLoader?.call(ctx, { baseUrl: "/" })).toBeUndefined();
    expect(await plugin.baseOptions?.call(ctx, { lang: undefined })).toBeUndefined();
    expect(await plugin.providerProps?.call(ctx, { lang: undefined })).toEqual({});
    const createView = vi.fn();
    await plugin.routes?.call(ctx, { createApi: vi.fn(), createView });
    expect(createView).not.toHaveBeenCalled();
    expect(
      await plugin.transformPage?.call(
        ctx,
        { lastModified: new Date() } as DocsPageData,
        undefined as never,
      ),
    ).toBeUndefined();

    const next = vi.fn(async () => new Response("page"));
    await plugin.middleware?.call(ctx, new Request("https://example.com/base/old/a"), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
