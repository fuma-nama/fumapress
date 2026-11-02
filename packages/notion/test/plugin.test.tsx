import type { Client } from "@notionhq/client";
import type { PluginContext } from "fumadocs-core/framework/plugin";
import type { ReactElement, ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { notionPlugin } from "../src/plugin";
import type { NotionRendererProps } from "../src/renderer";
import type { NotionIntegration, NotionPageData } from "../src/source";
import { block, dataSourceId, page, pageId, richText } from "./fixtures";

const assetId = "11111111-1111-4111-8111-111111111111";

function integration(client = {} as Client): NotionIntegration {
  return {
    $inferPage: undefined as never,
    client,
    dataSourceId,
    getBlocks: vi.fn(),
    dynamicSource: vi.fn(),
  };
}

/** a page with a heading and an image hosted by Notion */
function pageData(): NotionPageData {
  const image = block({
    id: assetId,
    type: "image",
    image: {
      type: "file",
      file: { url: "https://notion.example/signed", expiry_time: "2026-07-14" },
      caption: [richText("Architecture")],
    },
  });
  const heading = block({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: "heading_2",
    heading_2: { rich_text: [richText("Setup")], color: "default", is_toggleable: false },
  });
  const notionPage = page();

  return {
    id: pageId,
    notion: notionPage,
    title: "Introduction",
    load: vi.fn().mockResolvedValue({ page: notionPage, blocks: [heading, image] }),
    structuredData: vi.fn().mockResolvedValue({ headings: [], contents: [] }),
  };
}

/** a site with `data` as its only page */
function context(data: NotionPageData, mode: PluginContext["mode"] = "dynamic"): PluginContext {
  return {
    mode,
    withBase: (path) => path,
    getLoader: async () => ({ getPages: () => [{ data }] }) as never,
  };
}

async function renderHtml(node: ReactNode) {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}

describe("notionPlugin", () => {
  it("renders pages with their text, toc, dates and proxied files", async () => {
    const data = pageData();
    const plugin = notionPlugin(integration());
    const ctx = context(data);
    const pressPage = { data } as never;

    await expect(plugin.getPageText!.call(ctx, pressPage)).resolves.toBe("Setup\n\nArchitecture");
    await expect(plugin.getPageToc!.call(ctx, pressPage)).resolves.toEqual([
      { title: "Setup", url: "#aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", depth: 2 },
    ]);

    const body = await plugin.getPageBody!.call(ctx, pressPage);
    const { blocks, getFileUrl } = (body!.node as ReactElement<NotionRendererProps>).props;
    expect(getFileUrl!(blocks[1] as never)).toBe(
      `/api/notion/file?page=${pageId}&block=${assetId}`,
    );
    // the hooks of a page share one fetch of its blocks
    expect(data.load).toHaveBeenCalledOnce();
    expect(await plugin.getPageCreatedAt!.call(ctx, pressPage)).toEqual(
      new Date("2026-07-01T00:00:00.000Z"),
    );
    expect(await plugin.getPageLastModified!.call(ctx, pressPage)).toEqual(
      new Date("2026-07-02T00:00:00.000Z"),
    );
  });

  it("renders with a custom Renderer and a normalized proxy path", async () => {
    const data = pageData();
    const plugin = notionPlugin(integration(), {
      fileProxy: { path: "files/" },
      Renderer: ({ blocks, getFileUrl }: NotionRendererProps) => (
        <p data-blocks={blocks.length}>{getFileUrl?.(blocks[1] as never)}</p>
      ),
    });

    const body = await plugin.getPageBody!.call(context(data), { data } as never);
    expect(await renderHtml(body!.node)).toBe(
      `<p data-blocks="2">/files?page=${pageId}&amp;block=${assetId}</p>`,
    );
    expect((await plugin.routes!.call(context(data)))?.[0]?.path).toBe("/files");
  });

  it("refreshes signed files only when the block belongs to the configured data source", async () => {
    const asset = block({
      id: assetId,
      type: "image",
      image: {
        type: "file",
        file: { url: "https://notion.example/fresh", expiry_time: "2026-07-14" },
        caption: [],
      },
    });
    const client = {
      blocks: { retrieve: vi.fn().mockResolvedValue(asset) },
      pages: { retrieve: vi.fn().mockResolvedValue(page()) },
    } as unknown as Client;
    const plugin = notionPlugin(integration(client));
    const [route] = (await plugin.routes!.call(context(pageData())))!;

    const response = await route!.GET!(
      new Request(`https://press.test/api/notion/file?page=${pageId}&block=${assetId}`),
      { params: {} },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://notion.example/fresh");

    const unknown = await route!.GET!(
      new Request(
        `https://press.test/api/notion/file?page=99999999-9999-4999-8999-999999999999&block=${assetId}`,
      ),
      { params: {} },
    );
    expect(unknown.status).toBe(404);
  });

  it("requires the file proxy to be disabled for static exports", () => {
    const plugin = notionPlugin(integration());

    expect(() => plugin.init!.call(context(pageData(), "static"))).toThrow("fileProxy: false");
    expect(
      notionPlugin(integration(), { fileProxy: false }).routes!.call(context(pageData())),
    ).toBe(undefined);
  });
});
