import { describe, expect, it } from "vitest";
import type { Context, View, ViewRoute } from "@fumapress/core";
import { isValidElement } from "react";
import {
  changelogPlugin,
  type ChangelogIndexViewProps,
  type ChangelogPluginOptions,
} from "../src/plugin.tsx";

const pages = [
  {
    type: "changelog",
    path: "a.mdx",
    url: "/changelog/a",
    data: { title: "A", packages: { b: { version: "1.0.0" }, a: { version: "2.0.0" } } },
  },
  { type: "docs", path: "docs.mdx", url: "/docs", data: { title: "Docs" } },
  { type: "changelog", path: "b.mdx", url: "/changelog/b", data: { title: "B" } },
  { type: "releases", path: "c.mdx", url: "/releases/c", data: { title: "C" } },
];
const dates: Record<string, Date> = {
  "/changelog/a": new Date("2026-01-01"),
  "/changelog/b": new Date("2026-02-01"),
};

function context(body = true) {
  return {
    getLoader: async () => ({ getPages: () => pages }),
    getPageCreatedAt: async (page: { url: string }) => dates[page.url],
    getPageBody: async (page: { url: string }) => (body ? { node: page.url } : undefined),
  } as unknown as Context;
}

async function views(
  options: ChangelogPluginOptions<string> = { source: "changelog" },
  ctx = context(),
) {
  return (await changelogPlugin(options).views!.call(ctx, { lang: "en" })) as
    | ViewRoute[]
    | undefined;
}

function render(route: ViewRoute | undefined) {
  return route!.view({}, { request: new Request("http://localhost") });
}

describe("changelogPlugin", () => {
  it("adds the index view", async () => {
    expect((await views())?.map(({ path }) => path)).toEqual(["/changelog"]);
    expect(
      (await views({ source: "changelog", paths: { index: "/" } }))?.map(({ path }) => path),
    ).toEqual(["/"]);
    expect(await views({ source: "changelog", paths: { index: false } })).toBeUndefined();
  });

  it("renders the pages of its sources, newest first", async () => {
    const [route] = (await views({ source: ["changelog", "releases"] }))!;
    const view = (await render(route)) as View<{ "changelog.index": ChangelogIndexViewProps }>;
    expect(view.type).toBe("changelog.index");
    expect(isValidElement(view.node)).toBe(true);
    expect(
      view.props.entries.map(({ page, body, packages }) => ({ url: page.url, body, packages })),
    ).toEqual([
      { url: "/releases/c", body: "/releases/c", packages: [] },
      { url: "/changelog/b", body: "/changelog/b", packages: [] },
      {
        url: "/changelog/a",
        body: "/changelog/a",
        packages: [
          { name: "a", version: "2.0.0" },
          { name: "b", version: "1.0.0" },
        ],
      },
    ]);
  });

  it("provides its sources", () => {
    expect(changelogPlugin({ source: "changelog" }).api).toEqual({ source: ["changelog"] });
  });

  it("requires page bodies", async () => {
    const [route] = (await views(undefined, context(false)))!;
    await expect(render(route)).rejects.toThrow('the changelog page "a.mdx" has no body');
  });
});
