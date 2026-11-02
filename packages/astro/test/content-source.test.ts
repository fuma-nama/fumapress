import { expect, it, vi } from "vitest";
import { createPress, type Context } from "@fumapress/core";
import { contentSourcePlugin } from "@/content-source";

// it reads the config of the integration
vi.mock("@fumadocs/astro/source", () => ({ NoProcessedMarkdownError: class extends Error {} }));

it("leaves pages to the plugins of their content source", async () => {
  const data = { title: "Home", content: "%% raw %%", load: async () => ({}) };
  const ctx = (await createPress(
    {
      content: { docs: { files: [{ type: "page" as const, path: "index.md", data }] } },
      preset: false,
      plugins: [contentSourcePlugin(), { getPageText: () => "rendered" }],
    },
    { base: "/" },
  )) as Context;
  const [page] = (await ctx.getLoader()).getPages();

  expect(await ctx.getPageText(page!)).toBe("rendered");
});
