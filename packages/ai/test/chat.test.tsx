import { describe, expect, it } from "vitest";
import { createPress, type AppShape, type Context, type Plugin } from "@fumapress/core";
import { createPressContext } from "@fumapress/core/runtime";
import type { LanguageModel } from "ai";
import { aiPlugin } from "../src/chat";
import { mcpPlugin } from "../src/mcp";
import { AIChat } from "../src/components/chat";

const model = "test" as unknown as LanguageModel;
const ctx = {
  siteConfig: { name: "Test" },
  withBase: (path: string) => `/docs${path}`,
} as unknown as Context;

describe("aiPlugin", () => {
  it.each<[string, Plugin<AppShape, any>]>([
    ["/api/ai", aiPlugin({ model })],
    ["/mcp", mcpPlugin()],
  ])("serves %s on demand on any site", async (path, plugin) => {
    const site = await createPressContext(
      createPress({ files: [] }).plugins(plugin).config({ preset: [] }),
      {
        base: "/",
        defaults: [],
        signal: new AbortController().signal,
        isClientReference: () => false,
      },
    );
    site.setRuntimeRoutes([]);
    expect(await site.getApiRoutes()).toMatchObject([{ path, render: "dynamic" }]);
  });

  it("wraps every page in the chat of its endpoint, with no page actions", async () => {
    const plugin = aiPlugin({ model });
    expect(await plugin.slots!.call(ctx, { lang: undefined })).toEqual([
      {
        name: "ai:chat",
        region: "layout-wrapper",
        component: AIChat,
        props: { api: "/docs/api/ai" },
        order: -1,
      },
    ]);
    expect(await plugin.slots!.call(ctx, { lang: undefined, page: {} as never })).toBeUndefined();
  });

  it("adds no UI without `configureUI`", async () => {
    const plugin = aiPlugin({ model, configureUI: false });
    expect(await plugin.slots!.call(ctx, { lang: undefined })).toBeUndefined();
    expect(await plugin.slots!.call(ctx, { lang: undefined, page: {} as never })).toBeUndefined();
  });
});

describe("/api/ai", () => {
  it.each([
    ["system messages", { role: "system", parts: [{ type: "text", text: "x" }] }],
    [
      "files the server would download",
      { role: "user", parts: [{ type: "file", url: "https://a.b" }] },
    ],
    ["messages without parts", { role: "user" }],
  ])("refuses %s", async (_, message) => {
    const site = await createPressContext(
      createPress({ files: [] }).plugins(aiPlugin({ model })).config({ preset: [] }),
      {
        base: "/",
        defaults: [],
        signal: new AbortController().signal,
        isClientReference: () => false,
      },
    );
    site.setRuntimeRoutes([]);
    const routes = await site.getApiRoutes();
    const route = routes.find((item) => item.path === "/api/ai")!;
    const response = await route.POST!(
      new Request("https://example.com/api/ai", {
        method: "POST",
        body: JSON.stringify({ messages: [message] }),
      }),
      { params: {} },
    );

    expect(response.status).toBe(400);
  });
});
