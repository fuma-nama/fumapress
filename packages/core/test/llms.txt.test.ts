import { describe, expect, it, vi } from "vitest";

// `waku/router/server` needs the `react-server` condition, which this environment doesn't enable
vi.mock("waku/router/server", () => ({
  unstable_notFound: () => {
    throw new Error("not found");
  },
}));

// `LLMs.index` became async in fumadocs-core 16.15.11, the installed version may still be sync
vi.mock("fumadocs-core/source/llms", async (importOriginal) => {
  const mod = await importOriginal<typeof import("fumadocs-core/source/llms")>();

  return {
    ...mod,
    llms: (...args: Parameters<typeof mod.llms>) => {
      const instance = mod.llms(...args);
      return { ...instance, index: async (lang?: string) => instance.index(lang) };
    },
  };
});

import { appContext, type AppContext } from "@/app/context";
import type { RouteFns } from "@/lib/types";
import { llmsPlugin } from "@/plugins/llms.txt";
import { createApp } from "./fixtures";

type ApiConfig = Parameters<RouteFns["createApiIsomorphic"]>[0];

async function createRoutes(ctx: AppContext) {
  const handlers = new Map<string, ApiConfig["handler"]>();
  const plugin = llmsPlugin();
  const register = (config: ApiConfig) => {
    handlers.set(config.path, config.handler);
  };

  await plugin.prepareCreatePages!.call(ctx, { createPage: () => {} } as unknown as RouteFns);
  await appContext.run(ctx, () =>
    plugin.createPages!.call(ctx, {
      createApi: register,
      createApiIsomorphic: register,
    } as unknown as RouteFns),
  );
  return handlers;
}

describe("llmsPlugin", () => {
  it("awaits the generated index", async () => {
    const ctx = await createApp();
    const handlers = await createRoutes(ctx);

    const res = await appContext.run(ctx, () =>
      handlers.get("/llms.txt")!(new Request("https://example.com/llms.txt"), { params: {} }),
    );
    const txt = await res.text();

    expect(txt).not.toContain("[object Promise]");
    expect(txt).toContain("/docs/basics");
  });
});
