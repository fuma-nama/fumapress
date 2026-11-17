import { expect, test } from "vitest";
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { injectConfigProviderContext } from "../src/reka/config-provider";
import { pressKey, type PressState } from "../src/client";
import { getPressContext } from "../src/core/context";
import { directionOf } from "../src/core/i18n";
import { defineI18n, uiTranslations } from "../src/i18n";
import type { Plugin, ViewEnv } from "../src/core/plugin";
import { createPress, type Press } from "../src/core/press";
import { recommendedPreset } from "../src/core/preset";
import {
  searchIndexPath,
  siteDataPath,
  decodePath,
  encodePath,
  matchRoute,
  pageDataPath,
  prerenderListPath,
  staticPathsOf,
} from "../src/core/routes";
import type { Page, PageContent, SiteData, SourceFile } from "../src/core/types";
import { createFetchHandler } from "../src/server";
import Root from "../theme/Root.vue";
import { collectionOf, compiledDefineDocs, filesOf } from "./collection";

const collection = await collectionOf({
  "index.mdx": { title: "Home" },
  "guide/install.mdx": { title: "Install", description: "How to install" },
  "guide/meta.json": { title: "Guide" },
});

type Get = (path: string, init?: RequestInit) => Promise<Response>;

/** the server of a site, and `prerenderer`: the same site as the server a build prerenders with */
function serve(press: Press): Get & { prerenderer: Get } {
  return Object.assign(handlerOf(press, false), { prerenderer: handlerOf(press, true) });
}

function handlerOf(press: Press, prerender: boolean): Get {
  const handler = createFetchHandler({
    press,
    prerender,
    assets: { entry: "/assets/entry.js", css: [{ href: "/assets/style.css" }], js: [] },
    head: [{ tag: "script", content: "theme()" }],
    customPages: ["/about"],
    // like the app: the data of the site, then the content of the page
    async render({ pathname, lang, load }) {
      await load<SiteData>(siteDataPath(lang));
      const content = await load<PageContent>(pageDataPath(pathname));
      return {
        html: content ? `<h1>${content.pageData.title}</h1>` : "missing",
        status: content ? 200 : 404,
      };
    },
  });
  return (path: string, init?: RequestInit) =>
    handler(new Request(`http://localhost${path}`, init));
}

/** the list of a build, part by part, from the server a build prerenders with */
async function prerendered(
  get: ReturnType<typeof serve>,
): Promise<{ paths: string[]; parts: number }> {
  const paths: string[] = [];
  let next: string | undefined = prerenderListPath(0);
  let parts = 0;
  while (next) {
    const response: Response = await get.prerenderer(next);
    const header = response.headers.get("x-nitro-prerender")!;
    expect(header.length).toBeLessThan(8000);
    const listed = header.split(", ").filter(Boolean);
    next = listed.find((path) => /^\/_press\/routes\/\d+\.txt$/.test(path));
    paths.push(...listed.filter((path) => path !== next));
    parts++;
  }
  return { paths, parts };
}

function payloadOf(html: string): Record<string, unknown> {
  return JSON.parse(
    /<script type="application\/json" id="__PRESS__">(.*?)<\/script>/.exec(html)![1]!,
  );
}

const press = createPress(collection.toFumadocsSource())
  .plugins({
    name: "test",
    routes({ createApi }) {
      createApi({
        path: "/api/pages",
        GET: () => Response.json(this.getPages().map((p) => p.url)),
      });
      createApi({
        path: "/api/echo/[name]",
        POST: (_request, { params }) => Response.json(params),
      });
      createApi({ path: "/api/any", ALL: (request) => new Response(request.method) });
      createApi({
        path: "/data/[id]/info.json",
        render: "static",
        staticPaths: ["a", "b"],
        GET: (_request, { params }) => Response.json(params),
      });
    },
    transformPage: (_data, { page: current }) => ({ words: current?.path.length }),
    head: () => [
      { tag: "meta", attrs: { name: "description", content: "from the plugin" } },
      { tag: "meta", attrs: { name: "robots", content: "noindex" } },
    ],
    layoutProps: () => ({
      nav: { title: "From the plugin" },
      links: [{ text: "Blog", url: "/blog" }],
    }),
    async middleware(request, next) {
      const { pathname } = new URL(request.url);
      const response = await next(pathname === "/latest" ? "/guide/install" : undefined);
      const out = new Response(response.body, response);
      out.headers.set("x-test", "1");
      return out;
    },
  })
  .config({
    site: { name: "Docs", baseUrl: "https://example.com" },
    head: [{ tag: "meta", attrs: { name: "robots", content: "all" } }],
    ui: { layoutProps: { links: [{ text: "Home", url: "/" }] } },
  });

const get = serve(press);
const install: PageContent = {
  url: "/guide/install",
  // the frontmatter, and the page data with what plugins add
  data: { title: "Install", description: "How to install" },
  pageData: { title: "Install", description: "How to install", words: 17 },
  toc: [{ title: "Intro", url: "#intro", depth: 2 }],
  body: { module: "/assets/guide/install.mdx.js" },
  // what the browser shows of the head when it navigates here: the same tags as the document
  head: { title: "Install | Docs", description: "from the plugin" },
};

test("matches route patterns", async () => {
  expect(matchRoute("/sitemap.xml", "/sitemap.xml")).toEqual({});
  // paths are decoded once, where a request comes in: a param is the segment as it is
  expect(matchRoute("/api/[name]", "/api/hello there")).toEqual({ name: "hello there" });
  expect(decodePath("/api/hello%20there/")).toBe("/api/hello there");
  expect(decodePath("//api///x")).toBe("/api/x");
  expect(decodePath("/100%25")).toBe("/100%");
  // not paths of a page: a malformed escape, and an encoded separator, which would give a page a second path
  expect(decodePath("/a%")).toBeUndefined();
  expect(decodePath("/private%2Fsecret")).toBeUndefined();
  expect(decodePath("/%5Cevil.example")).toBeUndefined();
  expect(encodePath("/guide/my page/100%")).toBe("/guide/my%20page/100%25");
  expect(matchRoute("/files/[...path]", "/files/a/b")).toEqual({ path: "a/b" });
  expect(matchRoute("/api/[name]", "/api")).toBeUndefined();
  expect(matchRoute("/api", "/api/more")).toBeUndefined();

  expect(await staticPathsOf({ path: "/a.json" })).toEqual(["/a.json"]);
  expect(
    await staticPathsOf({ path: "/print/[...slugs]", staticPaths: () => [["a", "b"], "c"] }),
  ).toEqual(["/print/a/b", "/print/c"]);
});

test("renders a content page with its head and payload", async () => {
  const response = await get("/guide/install/");
  const html = await response.text();

  expect(response.status).toBe(200);
  expect(html).toContain("<title>Install | Docs</title>");
  expect(html).toContain('<link rel="canonical" href="https://example.com/guide/install">');
  expect(html).toContain('<link rel="stylesheet" href="/assets/style.css">');
  expect(html).toContain("<script>theme()</script>");
  expect(html).toContain('<link rel="modulepreload" href="/assets/guide/install.mdx.js">');
  expect(html).toContain('<div id="app"><h1>Install</h1></div>');

  // what the app loaded comes with the page, except shared data: the browser fetches it once, and the page
  // preloads it
  expect(payloadOf(html)).toEqual({ "/_press/pages/guide/install.json": install });
  expect(html).toContain(
    '<link rel="preload" href="/_press/site/en.json" as="fetch" crossorigin="anonymous">',
  );
});

test("serves the data of the site", async () => {
  const site: SiteData = await (await get(siteDataPath("en"))).json();
  expect(site.site).toEqual({ name: "Docs" });
  expect(site.tree.children).toEqual([
    expect.objectContaining({ type: "page", name: "Home", url: "/" }),
    expect.objectContaining({
      type: "folder",
      name: "Guide",
      children: [expect.objectContaining({ type: "page", name: "Install", url: "/guide/install" })],
    }),
  ]);
});

test("gives the app the data routes of plugins", async () => {
  const seen: unknown[] = [];
  const handler = createFetchHandler({
    press: createPress(collection.toFumadocsSource()).plugins({
      name: "data",
      routes({ createApi }) {
        createApi({ path: "/api/stars", data: () => ({ stars: 42 }) });
        createApi({ path: "/api/user/[name]", data: ({ params }) => params });
        createApi({ path: "/api/none", data: () => undefined });
      },
    }),
    assets: { entry: "", css: [], js: [] },
    async render({ load }) {
      // twice: the route runs once per page
      seen.push(await load("/api/stars"), await load("/api/stars"));
      seen.push(await load("/api/user/fuma"), await load("/api/none"), await load("/api/unknown"));
      return { html: "" };
    },
  });
  const request = (path: string) => handler(new Request(`http://localhost${path}`));

  const html = await (await request("/")).text();
  expect(seen).toEqual([{ stars: 42 }, { stars: 42 }, { name: "fuma" }, undefined, undefined]);
  expect(payloadOf(html)).toEqual({
    "/api/stars": { stars: 42 },
    "/api/user/fuma": { name: "fuma" },
  });

  // the browser requests the same routes
  expect(await (await request("/api/stars")).json()).toEqual({ stars: 42 });
  expect((await request("/api/none")).status).toBe(404);
});

test("generates a data route at build time, unless it renders on demand", async () => {
  const site = serve(
    createPress(collection.toFumadocsSource()).plugins({
      name: "data",
      routes({ createApi }) {
        createApi({ path: "/api/stars.json", data: () => ({ stars: 42 }) });
        createApi({ path: "/api/live.json", render: "dynamic", data: () => ({ now: 1 }) });
        createApi({ path: "/api/handler.json", GET: () => Response.json({}) });
      },
    }),
  );
  const { paths } = await prerendered(site);
  expect(paths).toContain("/api/stars.json");
  expect(paths).not.toContain("/api/live.json");
  expect(paths).not.toContain("/api/handler.json");
});

test("redirects where the app sent the page, like a hook of its router", async () => {
  const handler = (prerender: boolean) =>
    createFetchHandler({
      press: createPress(collection.toFumadocsSource()),
      base: "/docs/",
      prerender,
      assets: { entry: "", css: [], js: [] },
      render: async ({ pathname }) =>
        pathname === "/old" ? { html: "", redirect: "/guide/install?from=old" } : { html: "" },
    });

  const response = await handler(false)(new Request("http://localhost/docs/old"));
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("/docs/guide/install?from=old");
  // a static host can't redirect: the generated page sends the browser on
  const html = await (await handler(true)(new Request("http://localhost/docs/old"))).text();
  expect(html).toContain('content="0; url=/docs/guide/install?from=old"');
});

test("merges options: the site's own win, then plugins in order, then the defaults", async () => {
  const html = await (await get("/guide/install")).text();
  // by key: the config over the plugin, the plugin over the default from the page
  expect(html).toContain('<meta name="robots" content="all">');
  expect(html).toContain('<meta name="description" content="from the plugin">');
  expect(html).not.toContain('content="How to install"');

  // lists concatenate, and the first defined value wins
  const site: SiteData = await (await get(siteDataPath("en"))).json();
  expect(site.layoutProps).toEqual({
    nav: { title: "From the plugin", url: "/" },
    links: [
      { text: "Home", url: "/" },
      { text: "Blog", url: "/blog" },
    ],
    // from the search plugin of the preset
    search: { enabled: true, options: { type: "static", api: searchIndexPath("en") } },
  });
});

test("serves the content of a page for navigation in the browser", async () => {
  expect(await (await get("/_press/pages/guide/install.json")).json()).toEqual(install);
  expect((await (await get("/_press/pages/index.json")).json()).url).toBe("/");
  expect((await get("/_press/pages/nope.json")).status).toBe(404);
});

test("responds with 404 for a URL without a page", async () => {
  const response = await get("/missing");
  expect(response.status).toBe(404);
  expect(payloadOf(await response.text())).toEqual({});
});

test("serves API routes of plugins by method", async () => {
  expect((await (await get("/api/pages")).json()).sort()).toEqual(["/", "/guide/install"]);
  expect(await (await get("/api/echo/vue", { method: "POST" })).json()).toEqual({ name: "vue" });
  expect((await get("/api/echo/vue")).status).toBe(405);
  expect(await (await get("/api/any", { method: "DELETE" })).text()).toBe("DELETE");
});

test("runs middleware first, and rewrites with next(path)", async () => {
  const response = await get("/latest");
  expect(response.headers.get("x-test")).toBe("1");
  expect(await response.text()).toContain("<h1>Install</h1>");
});

test("serves the default plugins", async () => {
  const sitemap = await (await get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://example.com/guide/install</loc>");
  // a custom page without params is generated at build time, so it is listed too
  expect(sitemap).toContain("<loc>https://example.com/about</loc>");

  const robots = await (await get("/robots.txt")).text();
  expect(robots).toContain("Sitemap: https://example.com/sitemap.xml");

  const llms = await (await get("/llms.txt")).text();
  expect(llms).toContain("- [Install](https://example.com/guide/install): How to install");

  // the text of a Markdown page is its Markdown, under its title
  const full = await (await get("/llms-full.txt")).text();
  expect(full).toContain("# Install\n\n## Intro\n\nText of guide/install.mdx");
});

test("the default plugins leave out the pages their filter rejects", async () => {
  const filter = (current: Page) => current.path !== "guide/install.mdx";
  const filtered = serve(
    createPress(collection.toFumadocsSource()).config({
      site: { baseUrl: "https://example.com" },
      preset: recommendedPreset({ sitemap: { filter }, llms: { filter }, search: { filter } }),
    }),
  );

  const sitemap = await (await filtered("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://example.com/</loc>");
  expect(sitemap).not.toContain("/guide/install");
  const index: { url: string }[] = await (await filtered(searchIndexPath("en"))).json();
  expect(index.map((entry) => entry.url)).toEqual(["/"]);
  expect(await (await filtered("/llms.txt")).text()).not.toContain("Install");
  expect(await (await filtered("/llms-full.txt")).text()).not.toContain("Install");
  // the page itself is still served
  expect((await filtered("/guide/install")).status).toBe(200);
});

test("lists the paths to generate, only for the prerenderer", async () => {
  // a running server has no list, whatever a request claims to be
  const claim = { headers: { "x-nitro-prerender": prerenderListPath(0) } };
  expect((await get(prerenderListPath(0), claim)).status).toBe(404);
  expect((await prerendered(get)).paths).toEqual([
    "/",
    "/guide/install",
    "/data/a/info.json",
    "/data/b/info.json",
    "/sitemap.xml",
    "/robots.txt",
    "/llms.txt",
    "/llms-full.txt",
    "/_press/search/en.json",
    "/_press/site/en.json",
    "/_press/pages/index.json",
    "/_press/pages/guide/install.json",
    "/404.html",
    "/about",
  ]);
});

test("lists a large site in parts", async () => {
  const files = Array.from({ length: 400 }, (_, i) => [
    `a-long-folder-name/a-page-with-a-long-name-${i}.mdx`,
    { title: `Page ${i}` },
  ]);
  const large = serve(
    createPress((await collectionOf(Object.fromEntries(files))).toFumadocsSource()),
  );
  const { paths, parts } = await prerendered(large);

  expect(parts).toBeGreaterThan(1);
  expect(paths).toContain("/a-long-folder-name/a-page-with-a-long-name-399");
  expect(paths).toContain("/_press/pages/a-long-folder-name/a-page-with-a-long-name-399.json");
  expect(new Set(paths).size).toBe(paths.length);
});

test("gives server code the context of the site", async () => {
  await get("/");
  expect(getPressContext().site.name).toBe("Docs");
});

test("refuses a plugin listed twice", async () => {
  const twice = serve(
    createPress(collection.toFumadocsSource()).plugins({ name: "a" }, { name: "a" }),
  );
  await expect(twice("/")).rejects.toThrow('"a" is added twice');
});

// a custom source: its files come from anywhere, and a plugin renders them
const notes: Record<string, { title: string; html: string }> = {
  "index.md": { title: "Notes", html: "<p>Welcome</p>" },
  "first.md": { title: "First", html: "<p>The <b>first</b> note</p>" },
};
const notesPlugin: Plugin = {
  name: "notes",
  getPageBody: (current) =>
    "html" in current.data && typeof current.data.html === "string"
      ? { html: current.data.html }
      : undefined,
  getPageToc: () => [{ title: "Top", url: "#top", depth: 2 }],
  getPageText: (current) => `# ${current.data.title}`,
  getPageLastModified: () => new Date("2026-01-02T00:00:00Z"),
};
const noteFiles = () =>
  Object.entries(notes).map(
    ([path, data]): SourceFile<{ pageData: typeof data; metaData: {} }> => ({
      type: "page",
      path,
      data,
    }),
  );

test("renders the pages of a custom source through content hooks", async () => {
  const custom = serve(
    createPress({ files: noteFiles() })
      .plugins(notesPlugin)
      .config({ site: { baseUrl: "https://example.com" } }),
  );
  const content: PageContent = {
    url: "/first",
    // the data of the file as JSON, the same in the response of the server and of the data route
    data: notes["first.md"]!,
    // the date of `getPageLastModified` is in the page data too, for the layout
    pageData: { title: "First", lastModified: "2026-01-02T00:00:00.000Z" },
    toc: [{ title: "Top", url: "#top", depth: 2 }],
    body: { html: "<p>The <b>first</b> note</p>" },
    head: { title: "First" },
  };

  // the same as a Markdown page: with the first response, then by request
  expect(payloadOf(await (await custom("/first")).text())).toEqual({
    "/_press/pages/first.json": content,
  });
  expect(await (await custom("/_press/pages/first.json")).json()).toEqual(content);

  expect((await prerendered(custom)).paths).toEqual(
    expect.arrayContaining(["/", "/first", "/_press/pages/index.json", "/_press/pages/first.json"]),
  );
  expect(await (await custom("/llms-full.txt")).text()).toContain("# First");
  expect(await (await custom("/sitemap.xml")).text()).toContain(
    "<loc>https://example.com/first</loc><lastmod>2026-01-02T00:00:00.000Z</lastmod>",
  );
});

test("dates a Markdown page by the last commit of its file, with `lastModified: true`", async () => {
  const files = filesOf(
    { "index.mdx": { title: "Home" }, "draft.mdx": { title: "Draft" } },
    // the dates the Vite plugin read from git: a file without a commit has none
    { "./index.mdx": "2026-03-04T00:00:00.000Z" },
  );
  const docs = await compiledDefineDocs({ docs: { lastModified: true } }, files);
  // the frontmatter and the date: the compiled module is under a symbol, which JSON leaves out
  const [index, draft] = docs.toFumadocsSource().files.map((file) => ({ ...file.data }));
  expect(JSON.parse(JSON.stringify(index))).toEqual({
    title: "Home",
    lastModified: "2026-03-04T00:00:00.000Z",
  });
  expect(Object.keys(draft!)).toEqual(["title", "lastModified"]);

  const dated = serve(createPress(docs.toFumadocsSource()));
  const content: PageContent = await (await dated("/_press/pages/index.json")).json();
  expect(content.pageData.lastModified).toBe("2026-03-04T00:00:00.000Z");
  // the frontmatter as JSON, without the compiled module: a date is a string
  expect("data" in content && content.data).toEqual({
    title: "Home",
    lastModified: "2026-03-04T00:00:00.000Z",
  });
  expect(await (await dated("/sitemap.xml")).text()).toContain(
    "<lastmod>2026-03-04T00:00:00.000Z</lastmod>",
  );
  const undated: PageContent = await (await dated("/_press/pages/draft.json")).json();
  expect(undated.pageData.lastModified).toBeUndefined();
});

test("fails for a page no plugin renders", async () => {
  const unowned = serve(createPress({ files: noteFiles() }));
  await expect(unowned("/first")).rejects.toThrow('No plugin renders "first.md"');
});

test("reads a dynamic source on the server, and again when invalidated", async () => {
  const files = noteFiles();
  const dynamic = serve(createPress({ files: () => files }).plugins(notesPlugin));

  expect((await dynamic("/first")).status).toBe(200);
  expect((await dynamic("/second")).status).toBe(404);

  // its pages render on demand: none is generated at build time, and the routes listing them follow
  expect(getPressContext().getContentRender()).toBe("dynamic");
  expect((await prerendered(dynamic)).paths).toEqual(["/robots.txt", "/404.html", "/about"]);

  files.push({ type: "page", path: "second.md", data: { title: "Second", html: "<p>2</p>" } });
  await getPressContext().invalidateLoader();
  expect((await dynamic("/second")).status).toBe(200);
  expect((await dynamic("/_press/pages/second.json")).status).toBe(200);
});

test("keeps sources apart by key", async () => {
  const mixed = serve(
    createPress({
      docs: collection.toFumadocsSource({ baseDir: "docs" }),
      // `baseDir` of a source of its own, dynamic here
      notes: { baseDir: "notes", files: () => noteFiles() },
    }).plugins(notesPlugin),
  );
  await mixed("/");
  const ctx = getPressContext();

  expect(ctx.getPage("/docs/guide/install")?.type).toBe("docs");
  expect(ctx.getPage("/notes/first")?.type).toBe("notes");
  expect(ctx.getContentRender("docs")).toBe("static");
  expect(ctx.getContentRender("notes")).toBe("dynamic");

  const { paths } = await prerendered(mixed);
  expect(paths).toContain("/docs/guide/install");
  expect(paths).not.toContain("/notes/first");
});

test("runs build hooks once, and a file they emit is a static route", async () => {
  let runs = 0;
  const built = serve(
    createPress(collection.toFumadocsSource()).plugins({
      name: "build",
      async build({ paths, emitFile, fetch }) {
        runs++;
        const home = await fetch(new Request("http://localhost/"));
        emitFile("report.json", JSON.stringify({ paths: paths.length, home: home.status }));
      },
    }),
  );

  expect((await prerendered(built)).paths).toContain("/report.json");
  await prerendered(built);
  expect(runs).toBe(1);
  expect(await (await built.prerenderer("/report.json")).json()).toEqual({ paths: 12, home: 200 });
  // a running server never runs the hooks: it has no such file
  expect((await built("/report.json")).status).toBe(404);
});

test("adds the loader options of plugins", async () => {
  const seen: string[] = [];
  const configured = serve(
    createPress(collection.toFumadocsSource(), {
      loaderPlugins: [{ name: "own", config: (config) => (seen.push("own"), config) }],
    }).plugins({
      name: "loader",
      configureLoader: () => ({
        plugins: [{ name: "added", config: (config) => (seen.push("added"), config) }],
      }),
    }),
  );
  await configured("/");
  expect(seen).toEqual(["own", "added"]);
});

test("generates the not found page for static hosts", async () => {
  // on a server the path has no page, like any other, whatever a request claims to be
  const claim = { headers: { "x-nitro-prerender": "/404.html" } };
  expect((await get("/404.html", claim)).status).toBe(404);
  // the prerenderer gets the page, to write the file a static host serves
  const response = await get.prerenderer("/404.html");
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain('<div id="app">missing</div>');
  // the file is served at every URL without a page: it names none as the one to prefer
  expect(html).not.toContain('rel="canonical"');
});

test("keeps the data a page or an earlier plugin has set", async () => {
  const merged = serve(
    createPress(collection.toFumadocsSource()).plugins(
      { name: "first", transformPage: () => ({ title: "From the plugin", author: "first" }) },
      { name: "second", transformPage: () => ({ author: "second", reviewer: "second" }) },
    ),
  );
  const content: PageContent = await (await merged("/_press/pages/guide/install.json")).json();
  expect(content.pageData).toEqual({
    title: "Install",
    description: "How to install",
    author: "first",
    reviewer: "second",
  });
});

test("serves the pages of plugins as views", async () => {
  const posts: Record<string, string> = { hello: "Hello", bye: "Bye" };
  const blog = serve(
    createPress(collection.toFumadocsSource())
      .plugins({
        name: "blog",
        routes({ createView }) {
          createView({
            path: "/blog",
            data: { title: "Blog" },
            view: () => ({ type: "blog", props: { posts: Object.keys(posts) } }),
          });
          createView({
            path: "/blog/[slug]",
            staticPaths: Object.keys(posts),
            // the data of each page, over the one of the route
            data: { title: "A post", description: "From the blog" },
            view: ({ params: { slug } }) =>
              slug && posts[slug]
                ? { type: "post", props: { title: posts[slug] }, data: { title: posts[slug] } }
                : undefined,
          });
        },
      })
      .config({ site: { name: "Docs", baseUrl: "https://example.com" } }),
  );

  const content: PageContent = {
    url: "/blog/hello",
    type: "post",
    props: { title: "Hello" },
    pageData: { title: "Hello", description: "From the blog" },
    head: { title: "Hello | Docs", description: "From the blog" },
  };
  const html = await (await blog("/blog/hello")).text();
  expect(html).toContain("<title>Hello | Docs</title>");
  expect(payloadOf(html)).toEqual({ "/_press/pages/blog/hello.json": content });
  expect(await (await blog("/_press/pages/blog/hello.json")).json()).toEqual(content);
  expect(await (await blog("/blog")).text()).toContain("<title>Blog | Docs</title>");

  // a view without a page for its params is a 404
  expect((await blog("/blog/nope")).status).toBe(404);
  expect((await blog("/_press/pages/blog/nope.json")).status).toBe(404);

  // static by default: generated with the content, and in the sitemap
  expect((await prerendered(blog)).paths).toEqual(
    expect.arrayContaining([
      "/blog",
      "/blog/hello",
      "/blog/bye",
      "/_press/pages/blog.json",
      "/_press/pages/blog/bye.json",
    ]),
  );
  expect(await (await blog("/sitemap.xml")).text()).toContain(
    "<loc>https://example.com/blog/hello</loc>",
  );
});

test("renders a content page as a view when its plugin says so", async () => {
  const cards = serve(
    createPress({ files: noteFiles() }).plugins({
      name: "cards",
      getPageBody: (current) => ({ view: { type: "card", props: { title: current.data.title } } }),
    }),
  );
  const content: PageContent = await (await cards("/_press/pages/first.json")).json();
  expect(content).toMatchObject({
    data: notes["first.md"],
    body: { view: { type: "card", props: { title: "First" } } },
  });
});

test("sends the props of a view and the frontmatter of a page as JSON, the same on the server", async () => {
  let rendered: PageContent | undefined;
  const handler = createFetchHandler({
    press: createPress({ files: noteFiles() })
      .plugins(notesPlugin)
      .views({
        dated: { path: "/dated", view: () => ({ date: new Date("2026-01-02T00:00:00Z") }) },
      }),
    assets: { entry: "/assets/entry.js", css: [], js: [] },
    async render({ pathname, load }) {
      rendered = await load<PageContent>(pageDataPath(pathname));
      return { html: "" };
    },
  });
  const response = await handler(new Request("http://localhost/dated"));
  // what the server renders with is what the browser receives: a date is a string in both
  expect(payloadOf(await response.text())["/_press/pages/dated.json"]).toEqual(rendered);
  expect(rendered).toMatchObject({ type: "dated", props: { date: "2026-01-02T00:00:00.000Z" } });
});

test("gives the pages of a view their data, from its params and props", async () => {
  const tags = serve(
    createPress(collection.toFumadocsSource())
      .views({
        tag: {
          path: "/tags/[tag]",
          staticPaths: ["news"],
          view: ({ params }: ViewEnv) => ({ tag: params.tag, count: 2 }),
          data: ({ params, props }) => ({ title: `${props.count} posts tagged ${params.tag}` }),
        },
        about: { path: "/about", data: { title: "About" }, view: () => ({}) },
      })
      .config({ site: { name: "Docs" } }),
  );
  const content: PageContent = await (await tags("/_press/pages/tags/news.json")).json();
  expect(content.pageData).toEqual({ title: "2 posts tagged news" });
  expect(await (await tags("/tags/news")).text()).toContain(
    "<title>2 posts tagged news | Docs</title>",
  );
  expect(await (await tags("/about")).text()).toContain("<title>About | Docs</title>");
});

test("refuses a view of the site with the name of a source or of a view of a plugin", async () => {
  const named = (name: string) => ({ [name]: { path: "/x", view: () => ({}) } });
  // the theme renders a page by its type: one name for two kinds of pages is two pages for one component
  const source = serve(createPress({ notes: { files: noteFiles() } }).views(named("notes")));
  await expect(source("/")).rejects.toThrow(
    'The view "notes" of `.views()` has the name of the source "notes"',
  );

  const plugin = serve(
    createPress(collection.toFumadocsSource())
      .plugins({
        name: "blog",
        routes({ createView }) {
          createView({ path: "/blog", view: () => ({ type: "post", props: {} }) });
        },
      })
      .views(named("post")),
  );
  await expect(plugin("/blog")).rejects.toThrow(
    'The view "post" of `.views()` has the name of a view of the plugin "blog"',
  );
});

const languages = await collectionOf({
  "index.mdx": { title: "Home" },
  "index.cn.mdx": { title: "主页" },
  "guide/install.mdx": { title: "Install" },
  "guide/install.cn.mdx": { title: "安装" },
  "guide/english-only.mdx": { title: "English only" },
});

function i18nSite(hideLocale: "never" | "default-locale", fallbackLanguage?: null) {
  const i18n = defineI18n({
    languages: ["en", "cn"],
    defaultLanguage: "en",
    hideLocale,
    fallbackLanguage,
  });
  return serve(
    createPress(languages.toFumadocsSource(), { i18n })
      .plugins({
        name: "blog",
        routes({ createView }) {
          createView({
            path: "/blog",
            view: ({ lang }) => ({ type: "blog", props: { lang } }),
          });
        },
      })
      .config({
        site: { name: "Docs", baseUrl: "https://example.com" },
        ui: {
          translations: i18n
            .translations()
            .extend(uiTranslations())
            .add({ cn: { displayName: "中文", "Search(search trigger)": "搜索" } }),
        },
      }),
  );
}

test("serves each language at its prefix, with its own site data", async () => {
  const site = i18nSite("default-locale", null);

  const html = await (await site("/cn/guide/install")).text();
  expect(html).toContain('<html lang="cn" dir="ltr">');
  expect(html).toContain("<title>安装 | Docs</title>");
  expect(html).toContain('<link rel="preload" href="/_press/site/cn.json"');
  expect(html).toContain(
    '<link rel="alternate" hreflang="en" href="https://example.com/guide/install">',
  );
  expect(html).toContain(
    '<link rel="alternate" hreflang="cn" href="https://example.com/cn/guide/install">',
  );
  expect(await (await site("/guide/install")).text()).toContain('<html lang="en" dir="ltr">');

  const data: SiteData = await (await site(siteDataPath("cn"))).json();
  expect(data.i18n).toEqual({
    locale: "cn",
    defaultLanguage: "en",
    hideLocale: "default-locale",
    locales: [
      { locale: "en", name: "en" },
      { locale: "cn", name: "中文" },
    ],
    translations: { displayName: "中文", "Search(search trigger)": "搜索" },
  });
  expect(data.layoutProps.nav).toEqual({ title: "Docs", url: "/cn" });
  expect(data.layoutProps.search?.options).toEqual({ type: "static", api: searchIndexPath("cn") });
  expect(data.tree.children.map((node) => node.name)).toContain("主页");

  // without a fallback language, a page that is not translated doesn't exist there
  expect((await site("/guide/english-only")).status).toBe(200);
  expect((await site("/cn/guide/english-only")).status).toBe(404);

  // the plugins follow: a search index and `llms.txt` per language, views in each
  const index: { url: string }[] = await (await site(searchIndexPath("cn"))).json();
  expect(index.map((entry) => entry.url).toSorted()).toEqual(["/cn", "/cn/guide/install"]);
  expect(await (await site("/cn/llms.txt")).text()).toContain(
    "[安装](https://example.com/cn/guide/install)",
  );
  const view: PageContent = await (await site("/_press/pages/cn/blog.json")).json();
  expect(view).toMatchObject({ type: "blog", props: { lang: "cn" } });
  expect((await prerendered(site)).paths).toEqual(
    expect.arrayContaining(["/blog", "/cn/blog", "/cn", "/_press/site/cn.json", "/cn/llms.txt"]),
  );
});

test('puts `baseDir` after the folder of a language, with `parser: "dir"`', async () => {
  const i18n = defineI18n({ languages: ["en", "cn"], defaultLanguage: "en", parser: "dir" });
  const docs = await collectionOf({
    "en/guide.mdx": { title: "Guide" },
    "cn/guide.mdx": { title: "指南" },
  });
  const site = serve(createPress(docs.toFumadocsSource({ baseDir: "docs" }), { i18n }));
  await site("/");
  expect(
    getPressContext()
      .getPages()
      .map((page) => [page.url, page.locale]),
  ).toEqual([
    ["/en/docs/guide", "en"],
    ["/cn/docs/guide", "cn"],
  ]);
});

test("links the translations of a page by its URL, across sources", async () => {
  const i18n = defineI18n({ languages: ["en", "cn"], defaultLanguage: "en", parser: "dir" });
  const site = serve(
    createPress(
      {
        en: (await collectionOf({ "en/guide.mdx": { title: "Guide" } })).toFumadocsSource(),
        cn: (await collectionOf({ "cn/guide.mdx": { title: "指南" } })).toFumadocsSource(),
      },
      { i18n },
    ).config({ site: { baseUrl: "https://example.com" } }),
  );

  const html = await (await site("/cn/guide")).text();
  expect(html).toContain(
    '<link rel="alternate" hreflang="en" href="https://example.com/en/guide">',
  );
  expect(await (await site("/sitemap.xml")).text()).toContain(
    '<xhtml:link rel="alternate" hreflang="cn" href="https://example.com/cn/guide"/>',
  );
});

test("sends a URL without a language to the default one when none is hidden", async () => {
  const site = i18nSite("never");

  expect((await site("/en/guide/install")).status).toBe(200);
  const root = await site("/");
  expect(root.status).toBe(302);
  expect(root.headers.get("Location")).toBe("/en");
  expect((await site("/guide/install")).headers.get("Location")).toBe("/en/guide/install");
  // a URL with no page in any language stays a 404
  expect((await site("/nope")).status).toBe(404);
  // a page without a translation shows the default language
  expect((await site("/cn/guide/english-only")).status).toBe(200);
  // the redirect of `/` is generated too
  expect((await prerendered(site)).paths).toContain("/");
});

test("generates the redirect of the root as a document, for a host that can't redirect", async () => {
  const root = await i18nSite("never").prerenderer("/");
  expect(root.status).toBe(200);
  expect(root.headers.get("Content-Type")).toContain("text/html");
  expect(await root.text()).toContain('<meta http-equiv="refresh" content="0; url=/en">');
});

test("sends a URL with the prefix of the hidden language to the one without it", async () => {
  const site = i18nSite("default-locale");
  const response = await site("/en/guide/install");
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("/guide/install");
  expect((await site("/en")).headers.get("Location")).toBe("/");
  expect((await site("/en/nope")).status).toBe(404);
});

test("refuses to hide every language", async () => {
  const hidden = serve(
    createPress(languages.toFumadocsSource(), {
      i18n: { languages: ["en"], defaultLanguage: "en", hideLocale: "always" },
    }),
  );
  await expect(hidden("/")).rejects.toThrow('`hideLocale: "always"` is not supported');
});

test("the language decides the direction of the text, for the document and the UI", async () => {
  expect(directionOf("ar")).toBe("rtl");
  expect(directionOf("he-IL")).toBe("rtl");
  expect(directionOf("cn")).toBe("ltr");
  expect(directionOf("not a language")).toBe("ltr");

  const arabic = serve(createPress(collection.toFumadocsSource()).config({ site: { lang: "ar" } }));
  expect(await (await arabic("/")).text()).toContain('<html lang="ar" dir="rtl">');
  const site: SiteData = await (await arabic(siteDataPath("ar"))).json();
  expect(site.dir).toBe("rtl");

  // the root of the default theme gives the direction to the components of the UI
  const Direction = defineComponent(() => {
    const { dir } = injectConfigProviderContext();
    return () => h("p", dir?.value);
  });
  const app = createSSRApp({ render: () => h(Root, null, () => h(Direction)) });
  app.provide(pressKey, { site } as PressState);
  expect(await renderToString(app)).toContain("<p>rtl</p>");
});
