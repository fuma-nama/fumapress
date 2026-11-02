import type { ReactElement } from "react";
import { expect, it } from "vitest";
import type { NotionIntegration, NotionPageData, NotionRendererProps } from "../src";
import { notionPlugin } from "../src/plugin";

const dataSourceId = "33333333-3333-4333-8333-333333333333";
const pageId = "22222222-2222-4222-8222-222222222222";
const assetId = "11111111-1111-4111-8111-111111111111";
const image = {
  id: assetId,
  type: "image",
  image: { type: "file", file: { url: "https://notion.example/signed" } },
} as never;
const data = {
  id: pageId,
  notion: { object: "page", parent: { type: "data_source_id", data_source_id: dataSourceId } },
  load: async () => ({ blocks: [image] }),
} as unknown as NotionPageData;
const ctx = { mode: "dynamic", withBase: (path: string) => path } as never;

it("renders with a custom Renderer and a normalized proxy path", async () => {
  const Renderer = () => null;
  const plugin = notionPlugin({ dataSourceId } as NotionIntegration, {
    fileProxy: { path: "files/" },
    Renderer,
  });

  const body = await plugin.getPageBody!.call(ctx, { data } as never);
  const { type, props } = body!.node as ReactElement<NotionRendererProps>;
  expect(type).toBe(Renderer);
  expect(props.getFileUrl!(image)).toBe(`/files?page=${pageId}&block=${assetId}`);
  expect((await plugin.routes!.call(ctx))?.[0]?.path).toBe("/files");
});
