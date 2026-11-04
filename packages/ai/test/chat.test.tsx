import { describe, expect, it, vi } from "vitest";
import type { Context } from "@fumapress/core";
import type { LanguageModel } from "ai";
import { aiPlugin } from "../src/chat";
import { AIChat, AIChatAction } from "../src/components/chat";
import { ChatDocsLayout } from "../src/components/docs-layout";

const model = "test" as unknown as LanguageModel;
const ctx = {
  mode: "default",
  siteConfig: { name: "Test" },
  withBase: (path: string) => `/docs${path}`,
} as unknown as Context;

describe("aiPlugin", () => {
  it("serves /api/ai on the server", async () => {
    const plugin = aiPlugin({ model });
    const createApi = vi.fn();
    await plugin.routes!.call(ctx, { createApi, createView: vi.fn() });
    expect(createApi.mock.calls).toEqual([[{ path: "/api/ai", POST: expect.any(Function) }]]);
    expect(() =>
      plugin.routes!.call({ ...ctx, mode: "static" }, { createApi, createView: vi.fn() }),
    ).toThrow(/mode: 'static'/);
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
