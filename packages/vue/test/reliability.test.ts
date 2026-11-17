// What the reviews of the server found, kept from coming back: one path per page, routes that answer by method,
// rewrites, and setups that fail at the start with a message.
import { expect, test } from "vitest";
import type { Plugin } from "../src/core/plugin";
import { createPress, type Press } from "../src/core/press";
import { pageDataPath, prerenderListPath } from "../src/core/routes";
import type { PageContent } from "../src/core/types";
import { createFetchHandler } from "../src/server";
import { collectionOf } from "./collection";

const collection = await collectionOf({
  "index.mdx": { title: "Home" },
  "guide/install.mdx": { title: "Install" },
  "guide/my page.mdx": { title: "My page" },
  "guide/100%.mdx": { title: "Percent" },
  "private/secret.mdx": { title: "Secret" },
});
const docs = () => collection.toFumadocsSource();

function serve(press: Press, prerender = false) {
  const handler = createFetchHandler({
    press,
    prerender,
    assets: { entry: "/assets/entry.js", css: [], js: [] },
    async render({ pathname, load }) {
      const content = await load<PageContent>(pageDataPath(pathname));
      return {
        html: content ? `<h1>${content.data.title}</h1>` : "missing",
        status: content ? 200 : 404,
      };
    },
  });
  return (path: string, init?: RequestInit) =>
    handler(new Request(`http://localhost${path}`, init));
}

const titleOf = async (response: Response) =>
  /<h1>(.*?)<\/h1>/.exec(await response.text())?.[1] ?? response.status;

test("a page has one path, however a request spells it", async () => {
  const get = serve(createPress(docs()).config({ site: { baseUrl: "https://example.com" } }));

  expect(await titleOf(await get("/guide/install"))).toBe("Install");
  expect(await titleOf(await get("/guide/install/"))).toBe("Install");
  expect(await titleOf(await get("//guide///install"))).toBe("Install");
  expect(await titleOf(await get("/guide/my%20page"))).toBe("My page");
  // decoded once: `%25` is a percent sign, not the start of another escape
  expect(await titleOf(await get("/guide/100%25"))).toBe("Percent");
  expect(await titleOf(await get("/guide/%2541"))).toBe(404);

  // an encoded separator would be a second path to the page, past a check on the first one
  expect(await titleOf(await get("/private%2Fsecret"))).toBe(404);
  expect(await titleOf(await get("/private%252Fsecret"))).toBe(404);
  expect((await get("/_press/pages/private%2Fsecret.json")).status).toBe(404);
  // malformed, or the start of a URL to another site: not a page, and never a server error
  expect((await get("/guide/%E0%A4%A")).status).toBe(404);
  const html = await (await get("/%5Cevil.example/x")).text();
  expect(html).not.toContain("https://evil.example");
});

test("the page tree has the one form of a path, so the page on screen is found in it", async () => {
  const get = serve(createPress(docs()));
  const { tree } = (await (await get("/_press/site/en.json")).json()) as {
    tree: { children: { name: string; children?: { url: string }[] }[] };
  };
  const urls = tree.children.flatMap((node) => node.children?.map((item) => item.url) ?? []);
  expect(urls).toEqual(expect.arrayContaining(["/guide/my page", "/guide/100%"]));
});

test("middleware sees the one form of a path", async () => {
  const seen: string[] = [];
  const guard: Plugin = {
    name: "guard",
    async middleware(request, next) {
      const { pathname } = new URL(request.url);
      seen.push(pathname);
      return pathname.startsWith("/private/") ? new Response("no", { status: 403 }) : next();
    },
  };
  const get = serve(createPress(docs()).plugins(guard));

  for (const path of [
    "/private/secret",
    "//private/secret",
    "/private//secret/",
    "/private/%73ecret",
  ]) {
    expect((await get(path)).status, path).toBe(403);
  }
  expect(new Set(seen)).toEqual(new Set(["/private/secret"]));
  // what can't be a path of the site never reaches a page
  expect((await get("/private%2Fsecret")).status).toBe(404);
});

test("lists and serves paths with spaces encoded once", async () => {
  const press = createPress(docs()).plugins({
    name: "blog",
    routes({ createView }) {
      createView({
        path: "/blog/[slug]",
        staticPaths: ["hello world"],
        view: ({ params: { slug } }) => ({ type: "post", props: { slug } }),
      });
    },
  });
  const list = await (await serve(press, true)(prerenderListPath(0))).text();
  expect(list.split("\n")).toEqual(
    expect.arrayContaining([
      "/guide/my%20page",
      "/_press/pages/guide/my%20page.json",
      "/blog/hello%20world",
      "/_press/pages/blog/hello%20world.json",
      "/guide/100%25",
    ]),
  );

  const get = serve(press);
  const view: PageContent = await (await get("/_press/pages/blog/hello%20world.json")).json();
  expect(view.body).toEqual({ view: { type: "post", props: { slug: "hello world" } } });
});

test("a route answers the methods it handles, and leaves the others to the next one", async () => {
  const get = serve(
    createPress(docs()).plugins(
      {
        name: "first",
        routes({ createApi }) {
          createApi({ path: "/guide/[name]", POST: () => new Response("posted") });
          createApi({ path: "/api/items", POST: () => new Response("created") });
        },
      },
      {
        name: "second",
        routes({ createApi }) {
          createApi({ path: "/api/items", GET: () => Response.json(["a"]) });
        },
      },
    ),
  );

  // a route for another method doesn't hide a page, or a later route
  expect(await titleOf(await get("/guide/install"))).toBe("Install");
  expect(await (await get("/guide/install", { method: "POST" })).text()).toBe("posted");
  expect(await (await get("/api/items")).json()).toEqual(["a"]);
  expect(await (await get("/api/items", { method: "POST" })).text()).toBe("created");
  // a path with a route, and nothing for the method
  expect((await get("/api/items", { method: "DELETE" })).status).toBe(405);
  expect((await get("/nothing", { method: "POST" })).status).toBe(404);
});

test("a page served at another URL by a rewrite has its content under that URL", async () => {
  const get = serve(
    createPress(docs()).plugins({
      name: "latest",
      middleware: (request, next) =>
        next(new URL(request.url).pathname === "/latest" ? "/guide/install?tab=1" : undefined),
    }),
  );
  const html = await (await get("/latest")).text();
  expect(html).toContain("<h1>Install</h1>");
  // the browser is at `/latest`: it finds the content it hydrates with under that path
  const payload = JSON.parse(/id="__PRESS__">(.*?)<\/script>/.exec(html)![1]!);
  expect(Object.keys(payload)).toEqual(["/_press/pages/latest.json"]);
  expect(payload["/_press/pages/latest.json"].url).toBe("/guide/install");
});

test("refuses at the start what would fail or be ignored later", async () => {
  const start = (press: Press) => serve(press)("/");

  await expect(
    start(createPress(docs()).config({ site: { baseUrl: "docs.example.com" } })),
  ).rejects.toThrow("is not a URL");
  await expect(start(createPress(docs(), { plugins: [] } as never))).rejects.toThrow(
    "the plugins of the content loader are `loaderPlugins`",
  );
  const x = await collectionOf({ "x.mdx": { title: "X" } });
  await expect(
    start(createPress({ a: x.toFumadocsSource(), b: x.toFumadocsSource() })),
  ).rejects.toThrow('The sources "a" and "b" both have a file at "x.mdx"');
  // in the folder of `baseDir`, of any source
  await expect(
    start(
      createPress({
        a: x.toFumadocsSource({ baseDir: "docs" }),
        b: { baseDir: "/docs/", files: () => x.toFumadocsSource().files },
      }),
    ),
  ).rejects.toThrow('The sources "a" and "b" both have a file at "docs/x.mdx"');

  const withRoute = (
    route: Parameters<Parameters<NonNullable<Plugin["routes"]>>[0]["createApi"]>[0],
  ) =>
    start(
      createPress(docs()).plugins({ name: "routes", routes: ({ createApi }) => createApi(route) }),
    );
  await expect(withRoute({ path: "/data/[id].json", GET: () => new Response() })).rejects.toThrow(
    "a param is a whole segment",
  );
  await expect(withRoute({ path: "/[...rest]/more", GET: () => new Response() })).rejects.toThrow(
    "a rest param is the last segment",
  );
  await expect(
    withRoute({ path: "/a/[x]/[y]", render: "static", GET: () => new Response() }),
  ).rejects.toThrow("a static route has one param");
  await expect(
    withRoute({ path: "/x.json", data: () => 1, GET: () => new Response() }),
  ).rejects.toThrow("a data route answers `GET`");
});

test("a start that failed is tried again", async () => {
  let calls = 0;
  const get = serve(
    createPress({
      files: () => {
        if (++calls === 1) throw new Error("the CMS is down");
        return [{ type: "page", path: "index.md", data: { title: "Home" } }];
      },
    }).plugins({ name: "html", getPageBody: () => ({ html: "" }) }),
  );

  await expect(get("/")).rejects.toThrow("the CMS is down");
  expect(await titleOf(await get("/"))).toBe("Home");
  expect(calls).toBe(2);
});
