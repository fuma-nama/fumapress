import { describe, expect, it, vi } from "vitest";
import { createPress, pageAlternate, type Context, type Plugin } from "@fumapress/core";
import { registerReference } from "@/island/references";
import * as client from "./fixtures/client";

const runtime = vi.hoisted(() => ({ ctx: undefined as Context | undefined }));
vi.mock("@/runtime", () => ({
  getPressContext: () => runtime.ctx,
  getProviderData: () => ({ pathname: "/cn/blog", params: {} }),
}));
vi.mock("@/content-source", () => ({}));
vi.mock("virtual:fumapress/page", () => ({ default: undefined }));
vi.mock("virtual:fumapress/layout", () => ({}));
vi.mock("astro:transitions/client", () => ({ navigate() {} }));
vi.mock("astro:config/client", () => ({ base: "/", trailingSlash: "ignore" }));

const { getHeadTags, getHomeLayout } = await import("@/ui/page");
const astro = { url: new URL("http://localhost/cn/blog"), params: {} };

async function site(plugin: Plugin = {}) {
  runtime.ctx = (await createPress(
    { content: {}, preset: false, site: { baseUrl: "https://example.com" }, plugins: [plugin] },
    { base: "/" },
  )) as Context;
  return runtime.ctx;
}

describe("layouts", () => {
  it("wrap the layout in `layout.wrapper`, inside the root provider", async () => {
    registerReference("provider", await import("@/ui/provider"));
    registerReference("home", await import("@/ui/home"));
    registerReference("client", client);
    await site({
      slots: ({ page }) => (page ? [] : [{ slot: "layout.wrapper", component: client.Frame }]),
    });
    const { tree } = (await getHomeLayout(astro, {})).island;

    expect(tree.indexOf('"Provider"')).toBeGreaterThan(-1);
    expect(tree.indexOf('"Frame"')).toBeGreaterThan(tree.indexOf('"Provider"'));
    expect(tree.indexOf('"Home"')).toBeGreaterThan(tree.indexOf('"Frame"'));
  });
});

describe("head tags", () => {
  it("link the translations of your page", async () => {
    const ctx = await site();
    const tags = await getHeadTags({
      title: "Blog",
      pathname: "/cn/blog",
      alternates: [pageAlternate(ctx, "en", "/en/blog"), pageAlternate(ctx, "cn", "/cn/blog")],
    });

    expect(tags).toContainEqual({
      tag: "link",
      attrs: { rel: "canonical", href: "https://example.com/cn/blog" },
    });
    expect(tags).toContainEqual({
      tag: "link",
      attrs: { rel: "alternate", hreflang: "en", href: "https://example.com/en/blog" },
    });
  });
});
