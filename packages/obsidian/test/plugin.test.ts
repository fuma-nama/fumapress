import { loader } from "fumadocs-core/source";
import { obsidian } from "fumadocs-obsidian";
import { watchWithVite } from "fumadocs-obsidian/dev/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToReadableStream } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { obsidianPlugin } from "../src/plugin";

vi.mock("fumadocs-obsidian/dev/vite", () => ({ watchWithVite: vi.fn(() => () => {}) }));

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

it("renders vault pages with the MDX components of Fumadocs UI, watching the vault", async () => {
  const vault = obsidian({ dir: fixturesDir });
  const content = loader(await vault.staticSource(), { baseUrl: "/" });
  const plugin = obsidianPlugin(vault);
  const context = { getLoader: async () => content } as never;

  const body = await plugin.getPageBody!.call(context, content.getPage(["Welcome"])! as never);
  const stream = await renderToReadableStream(body!.node);
  await stream.allReady;
  const html = await new Response(stream).text();

  expect(html).toContain("scroll-m-28");
  expect(html).toContain('href="/Guides/Publishing"');
  await vi.waitFor(() => expect(watchWithVite).toHaveBeenCalledWith(vault));
});
