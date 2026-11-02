import type { PluginContext } from "fumadocs-core/framework/plugin";
import { loader } from "fumadocs-core/source";
import { obsidian } from "fumadocs-obsidian";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { obsidianPlugin } from "../src/plugin";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("obsidianPlugin", () => {
  it("renders the body, text, toc, and structured data of vault pages", async () => {
    const vault = obsidian({ dir: fixturesDir });
    const content = loader(await vault.staticSource(), { baseUrl: "/" });
    const page = content.getPage(["Welcome"]);
    if (!page) throw new Error("expected Welcome page");
    const renderer = await page.data.load();
    const render = vi.spyOn(renderer, "render");

    const plugin = obsidianPlugin(vault, { watch: false });
    const context: PluginContext = {
      mode: "default",
      withBase: (pathname) => pathname,
      getLoader: async () => content,
    };

    await expect(plugin.getPageText!.call(context, page)).resolves.toContain(
      "Wikilinks, embeds, callouts",
    );
    await expect(plugin.getPageStructuredData!.call(context, page)).resolves.toMatchObject({
      headings: [{ content: "Welcome" }],
    });
    await expect(plugin.getPageToc!.call(context, page)).resolves.toMatchObject([
      { url: "#welcome", depth: 1 },
    ]);

    const body = await plugin.getPageBody!.call(context, page);
    const stream = await renderToReadableStream(body!.node);
    await stream.allReady;
    const html = await new Response(stream).text();

    expect(render).toHaveBeenCalledOnce();
    expect(html).toContain("Vault content");
    expect(html).toContain('href="/Guides/Publishing"');
    expect(html).toContain("bg-fd-card");
  });

  it("ignores structurally similar pages outside the configured vault", async () => {
    const vault = obsidian({ dir: fixturesDir });
    const plugin = obsidianPlugin(vault, { watch: false });
    const page = {
      absolutePath: path.resolve(fixturesDir, "../outside.md"),
      data: {
        title: "Outside",
        content: "Outside",
        frontmatter: {},
        load: async () => ({ structuredData: { headings: [], contents: [] } }),
      },
    };

    await expect(plugin.getPageText!.call({} as PluginContext, page as never)).resolves.toBe(
      undefined,
    );
  });
});
