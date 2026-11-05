import { describe, expect, it, vi } from "vitest";
import { createPress, type AppShape, type Context, type Plugin } from "@fumapress/core";
import { createPressContext } from "@fumapress/core/runtime";
import type { LanguageModel } from "ai";
import { aiPlugin } from "../src/chat";
import { mcpPlugin } from "../src/mcp";
import { AIChat, AIChatAction } from "../src/components/chat";
import { ChatDocsLayout } from "../src/components/docs-layout";

const model = "test" as unknown as LanguageModel;
const ctx = {
  siteConfig: { name: "Test" },
  withBase: (path: string) => `/docs${path}`,
} as unknown as Context;

describe("aiPlugin", () => {
  it("serves /api/ai on the server", async () => {
    const plugin = aiPlugin({ model });
    const createApi = vi.fn();
    await plugin.routes!.call(ctx, { createApi, createView: vi.fn() });
    expect(createApi.mock.calls).toEqual([[{ path: "/api/ai", POST: expect.any(Function) }]]);
  });

  it.each<[string, Plugin<AppShape, any>]>([
    ["/api/ai", aiPlugin({ model })],
    ["/mcp", mcpPlugin()],
  ])("refuses %s on `mode: 'static'`", async (path, plugin) => {
    const site = await createPressContext(
      createPress({ files: [] }).plugins(plugin).config({ mode: "static", preset: [] }),
      {
        base: "/",
        defaults: [],
        signal: new AbortController().signal,
        isClientReference: () => false,
      },
    );
    site.setRuntimeRoutes([]);
    await expect(site.getApiRoutes()).rejects.toThrow(
      `the route "${path}" of "${plugin.name}" renders on request`,
    );
  });

  it("provides the chat that the built-in UI docks", () => {
    expect(aiPlugin({ model })).toMatchObject({
      provides: ["ai-chat"],
      api: { DocsLayout: ChatDocsLayout },
    });
  });

  it("wraps every page in the chat of its endpoint", async () => {
    expect(await aiPlugin({ model }).slots!.call(ctx, {})).toEqual([
      { slot: "layout.wrapper", component: AIChat, props: { api: "/docs/api/ai" }, order: -1 },
    ]);
  });

  it("adds the `ai` action to content pages", async () => {
    expect(await aiPlugin({ model }).slots!.call(ctx, { page: {} as never })).toEqual([
      { slot: "actions", name: "ai", component: AIChatAction },
    ]);
  });

  it("adds no UI without `configureUI`", async () => {
    const plugin = aiPlugin({ model, configureUI: false });
    expect(plugin.provides).toEqual([]);
    expect(await plugin.slots!.call(ctx, {})).toBeUndefined();
    expect(await plugin.slots!.call(ctx, { page: {} as never })).toBeUndefined();
  });
});
