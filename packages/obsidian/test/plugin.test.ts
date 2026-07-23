import { loader } from "fumadocs-core/source";
import { obsidian } from "fumadocs-obsidian";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { obsidianPlugin } from "../src/plugin";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("obsidianPlugin", () => {
  it("registers body, text, toc, and structured-data adapters", async () => {
    const vault = obsidian({ dir: fixturesDir });
    const content = loader(await vault.staticSource(), { baseUrl: "/" });
    const page = content.getPage(["Welcome"]);
    if (!page) throw new Error("expected Welcome page");
    const renderer = await page.data.load();
    const render = vi.spyOn(renderer, "render");

    const plugin = obsidianPlugin(vault, { watch: false });
    const context = {
      adapters: [] as Record<string, unknown>[],
      getLoader: async () => content,
    };

    await plugin.init?.call(context as never);
    const adapter = context.adapters[0]!;

    await expect(callAdapter(adapter, "core:get-text", page, context)).resolves.toContain(
      "Wikilinks, embeds, callouts",
    );
    await expect(
      callAdapter(adapter, "core:get-structured-data", page, context),
    ).resolves.toMatchObject({ headings: [{ content: "Welcome" }] });
    await expect(callAdapter(adapter, "core:render-toc", page, context)).resolves.toMatchObject([
      { url: "#welcome", depth: 1 },
    ]);

    const body = (await callAdapter(adapter, "core:get-body", page, context)) as {
      node: React.ReactNode;
    };
    const stream = await renderToReadableStream(body.node);
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
    const context = { adapters: [] as Record<string, unknown>[] };

    await plugin.init?.call(context as never);
    const adapter = context.adapters[0]!;
    const page = {
      absolutePath: path.resolve(fixturesDir, "../outside.md"),
      data: {
        title: "Outside",
        content: "Outside",
        frontmatter: {},
        load: async () => ({ structuredData: { headings: [], contents: [] } }),
      },
    };

    await expect(callAdapter(adapter, "core:get-text", page, context)).resolves.toBeUndefined();
  });
});

async function callAdapter(
  adapter: Record<string, unknown>,
  name: string,
  page: unknown,
  context: object,
): Promise<unknown> {
  const handler = adapter[name] as (this: object, page: unknown) => unknown;
  return handler.call(context, page);
}
