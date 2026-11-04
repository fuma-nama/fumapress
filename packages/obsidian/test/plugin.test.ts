import { loader } from "fumadocs-core/source";
import { obsidian } from "fumadocs-obsidian";
import { watchWithVite } from "fumadocs-obsidian/dev/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToReadableStream } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { obsidianPlugin } from "../src/plugin";

const dispose = vi.hoisted(() => vi.fn());
vi.mock("fumadocs-obsidian/dev/vite", () => ({ watchWithVite: vi.fn(() => dispose) }));

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

it("renders vault pages with the MDX components of Fumadocs UI, watching the vault until the context ends", async () => {
  const vault = obsidian({ dir: fixturesDir });
  const content = loader(await vault.staticSource(), { baseUrl: "/" });
  const plugin = obsidianPlugin(vault);
  const controller = new AbortController();
  const context = { getLoader: async () => content, signal: controller.signal } as never;
  await plugin.init!.call(context);
  expect(watchWithVite).toHaveBeenCalledWith(vault);

  const body = await plugin.getPageBody!.call(context, content.getPage(["Welcome"])! as never);
  const stream = await renderToReadableStream(body!.node);
  await stream.allReady;
  const html = await new Response(stream).text();

  expect(html).toContain("scroll-m-28");
  expect(html).toContain('href="/Guides/Publishing"');
  expect(dispose).not.toHaveBeenCalled();
  controller.abort();
  expect(dispose).toHaveBeenCalledOnce();
});
