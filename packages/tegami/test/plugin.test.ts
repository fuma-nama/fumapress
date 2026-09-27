import { describe, expect, it } from "vitest";
import type { AppContext, RouteFns } from "fumapress";
import { changelogPlugin, type ChangelogPluginOptions } from "../src/plugin.tsx";

async function routes(options: ChangelogPluginOptions = {}) {
  const pages: string[] = [];
  const layouts: string[] = [];

  await changelogPlugin(options).createPages!.call(
    {} as AppContext,
    {
      createPage: (page: { path: string }) => pages.push(page.path),
      createLayout: (layout: { path: string }) => layouts.push(layout.path),
      createInterceptor: () => {},
    } as unknown as RouteFns,
  );

  return { layouts, pages };
}

describe("changelogPlugin", () => {
  it("registers the layout and index page", async () => {
    expect(await routes()).toEqual({
      layouts: ["/(changelog)"],
      pages: ["/(changelog)/changelog"],
    });
  });

  it("follows the configured index path", async () => {
    expect((await routes({ paths: { index: "/" } })).pages).toEqual(["/(changelog)"]);
    expect((await routes({ paths: { index: false } })).pages).toEqual([]);
  });
});
