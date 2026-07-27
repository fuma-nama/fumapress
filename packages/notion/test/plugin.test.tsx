import type { Client } from "@notionhq/client";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { notionPlugin } from "../src/plugin";
import type { NotionIntegration, NotionPageData } from "../src/source";
import { block, dataSourceId, page, pageId, richText } from "./fixtures";

describe("notionPlugin", () => {
  it("registers rendering, text, toc, structured data, and date adapters", async () => {
    const image = block({
      id: "11111111-1111-4111-8111-111111111111",
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
    const load = vi.fn().mockResolvedValue({ page: notionPage, blocks: [heading, image] });
    const data: NotionPageData = {
      id: pageId,
      notion: notionPage,
      title: "Introduction",
      load,
      structuredData: vi.fn().mockResolvedValue({ headings: [], contents: [] }),
    };
    const integration = {
      $inferPage: undefined as never,
      client: {} as Client,
      dataSourceId,
      getBlocks: vi.fn(),
      dynamicSource: vi.fn(),
    } satisfies NotionIntegration;
    const plugin = notionPlugin(integration);
    const context = { adapters: [] as Record<string, unknown>[], mode: "dynamic" };

    await plugin.init?.call(context as never);
    const adapter = context.adapters[0]!;
    const pressPage = { data } as never;
    await expect(callAdapter(adapter, "core:get-text", pressPage)).resolves.toBe(
      "Setup\n\nArchitecture",
    );
    await expect(callAdapter(adapter, "core:render-toc", pressPage)).resolves.toEqual([
      { title: "Setup", url: "#aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", depth: 2 },
    ]);

    const body = (await callAdapter(adapter, "core:get-body", pressPage)) as {
      node: React.ReactNode;
    };
    const stream = await renderToReadableStream(body.node);
    await stream.allReady;
    const html = await new Response(stream).text();
    expect(html).toContain(
      "/api/notion/file?page=22222222-2222-4222-8222-222222222222&amp;block=11111111-1111-4111-8111-111111111111",
    );
    expect(load).toHaveBeenCalledTimes(3);
    expect(await callAdapter(adapter, "core:get-creation-date", pressPage)).toEqual(
      new Date("2026-07-01T00:00:00.000Z"),
    );
    expect(await callAdapter(adapter, "core:get-modified-date", pressPage)).toEqual(
      new Date("2026-07-02T00:00:00.000Z"),
    );
  });

  it("refreshes signed files only when the block belongs to the configured data source", async () => {
    const assetId = "11111111-1111-4111-8111-111111111111";
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
    const integration = {
      $inferPage: undefined as never,
      client,
      dataSourceId,
      getBlocks: vi.fn(),
      dynamicSource: vi.fn(),
    } satisfies NotionIntegration;
    const plugin = notionPlugin(integration);
    let route: { handlers: { GET: (request: Request) => Promise<Response> } } | undefined;
    const context = { mode: "dynamic" };

    await plugin.createPages?.call(
      context as never,
      {
        createApi(value: unknown) {
          route = value as typeof route;
        },
      } as never,
    );
    const response = await route!.handlers.GET(
      new Request(`https://press.test/api/notion/file?page=${pageId}&block=${assetId}`),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://notion.example/fresh");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");

    const embedId = "66666666-6666-4666-8666-666666666666";
    (client.blocks.retrieve as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      block({
        id: embedId,
        type: "embed",
        embed: {
          url: "https://files.notion-static.com/example.html?X-Amz-Signature=signed",
          caption: [],
        },
      }),
    );
    const htmlEmbed = await route!.handlers.GET(
      new Request(`https://press.test/api/notion/file?page=${pageId}&block=${embedId}`),
    );
    expect(htmlEmbed.status).toBe(302);
    expect(htmlEmbed.headers.get("Location")).toContain("X-Amz-Signature=signed");

    (client.pages.retrieve as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      page({
        parent: {
          type: "data_source_id",
          data_source_id: "99999999-9999-4999-8999-999999999999",
          database_id: "44444444-4444-4444-8444-444444444444",
        },
      }),
    );
    const denied = await route!.handlers.GET(
      new Request(`https://press.test/api/notion/file?page=${pageId}&block=${assetId}`),
    );
    expect(denied.status).toBe(404);
  });

  it("requires the file proxy to be disabled for static exports", () => {
    const integration = {
      $inferPage: undefined as never,
      client: {} as Client,
      dataSourceId,
      getBlocks: vi.fn(),
      dynamicSource: vi.fn(),
    } satisfies NotionIntegration;
    const plugin = notionPlugin(integration);

    expect(() => plugin.createPages?.call({ mode: "static" } as never, {} as never)).toThrow(
      "file proxy is not compatible with static mode",
    );
  });
});

async function callAdapter(
  adapter: Record<string, unknown>,
  name: string,
  page: never,
): Promise<unknown> {
  const handler = adapter[name] as (page: never) => unknown;
  return handler(page);
}
