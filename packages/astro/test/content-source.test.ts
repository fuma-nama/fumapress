import { isValidElement, type ReactElement } from "react";
import type { MDXComponents } from "mdx/types";
import { expect, it, vi } from "vitest";
import { contentSourcePlugin } from "@/content-source";
import { pressContext, type TestSite } from "./harness";
import { AstroContent } from "@/island/serialize";
import { Link } from "@/ui/link";

// it reads the config of the integration
vi.mock("@fumadocs/astro/source", () => ({ NoProcessedMarkdownError: class extends Error {} }));
vi.mock("astro:config/client", () => ({ base: "/", trailingSlash: "ignore" }));

/** a site of pages by path, with the content source plugin */
function site(pages: Record<string, object>, config: Omit<TestSite, "content"> = {}) {
  const files = [];
  for (const [path, data] of Object.entries(pages))
    files.push({ type: "page" as const, path, data });
  return pressContext(
    { content: { docs: { files } }, ...config },
    { defaults: [contentSourcePlugin()] },
  );
}

it("leaves pages to the plugins of their content source", async () => {
  const data = { title: "Home", content: "%% raw %%", load: async () => ({}) };
  const ctx = await site({ "index.md": data }, { plugins: [{ getPageText: () => "rendered" }] });
  const [page] = (await ctx.getLoader()).getPages();

  expect(await ctx.getPageText(page!)).toBe("rendered");
});

it("renders pages of runtime sources once, with relative links, and again after a failure", async () => {
  const render = vi
    .fn<(components: MDXComponents) => Promise<{ body: string; toc: [] }>>()
    .mockRejectedValueOnce(new Error("transient"))
    .mockResolvedValue({ body: "body", toc: [] });
  const data = {
    title: "Home",
    load: async () => ({ structuredData: { headings: [], contents: [] }, render }),
  };
  const ctx = await site({ "index.md": data, "guide/other.md": { title: "Other" } });
  const page = (await ctx.getLoader()).getPage([])!;

  await expect(ctx.getPageBody(page)).rejects.toThrow("transient");
  expect(await ctx.getPageBody(page)).toEqual({ node: "body" });
  expect(await ctx.getPageToc(page)).toEqual([]);
  expect(render).toHaveBeenCalledTimes(2);

  const A = render.mock.calls[0]![0].a as (props: {
    href: string;
  }) => ReactElement<{ href: string }>;
  const link = A({ href: "./guide/other.md" });
  expect(link.props.href).toBe("/guide/other");
  // without an `a` in the MDX components, links still go through the base path
  expect(link.type).toBe(Link);
});

it("renders collection pages as their `<Content />`, dated by the `date` frontmatter", async () => {
  const Content = () => new Response();
  const data = {
    title: "Post",
    date: "2026-11-04",
    getText: async () => "",
    load: async () => ({ body: Content, toc: [] }),
  };
  const ctx = await site({ "post.mdx": data, "guide/other.mdx": { title: "Other" } });
  const page = (await ctx.getLoader()).getPage(["post"])!;
  const body = await ctx.getPageBody(page);

  expect(isValidElement(body?.node) && body.node.type).toBe(AstroContent);
  expect(body?.node).toHaveProperty("props.component", Content);
  const { props } = body!.node as ReactElement<{ components: MDXComponents }>;
  const A = props.components.a as (props: { href: string }) => ReactElement<{ href: string }>;
  expect(A({ href: "./guide/other.mdx#usage" }).props.href).toBe("/guide/other#usage");
  expect(await ctx.getPageCreatedAt(page)).toEqual(new Date("2026-11-04"));
});
