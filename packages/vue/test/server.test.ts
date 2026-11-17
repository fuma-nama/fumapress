import { expect, test } from "vitest";
import { createCollection } from "../src/collection";
import { getPressContext } from "../src/core/context";
import { defineI18n } from "../src/core/i18n";
import type { Plugin } from "../src/core/plugin";
import { createPress, type Press } from "../src/core/press";
import {
  searchIndexPath,
  siteDataPath,
  matchRoute,
  pageDataPath,
  prerenderListPath,
  staticPathsOf,
} from "../src/core/routes";
import type { PageContent, SiteData, SourceFile } from "../src/core/types";
import type { ModuleRef } from "../src/plugins/markdown";
import { createFetchHandler } from "../src/server";

/** a page as the Vite plugin lists it: with its compiled module */
function page(path: string, data: Record<string, unknown>): SourceFile {
  const ref: ModuleRef = {
    file: `content/${path}`,
    assets: async () => ({ entry: `/assets/${path}.js` }),
    load: async () => ({
      default: () => null,
      toc: [{ title: "Intro", url: "#intro", depth: 2 }],
      structuredData: {
        headings: [{ id: "intro", content: "Intro" }],
        contents: [{ heading: "intro", content: `Text of ${path}` }],
      },
    }),
  };
  return { type: "page", path, data: { ...data, _module: ref } };
}

const collection = createCollection("docs", [
  page("index.mdx", { title: "Home" }),
  page("guide/install.mdx", { title: "Install", description: "How to install" }),
  { type: "meta", path: "guide/meta.json", data: { title: "Guide" } },
]);

function serve(press: Press) {
  const handler = createFetchHandler({
    press,
    assets: { entry: "/assets/entry.js", css: [{ href: "/assets/style.css" }], js: [] },
    head: [{ tag: "script", content: "theme()" }],
    staticPaths: ["/about"],
    // like the app: the data of the site, then the content of the page
    async render({ pathname, lang, load }) {
      await load<SiteData>(siteDataPath(lang));
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

/** the list of a build, part by part: only the prerenderer of Nitro gets one */
async function prerendered(
  get: ReturnType<typeof serve>,
): Promise<{ paths: string[]; parts: number }> {
  const paths: string[] = [];
  let next: string | undefined = prerenderListPath(0);
  let parts = 0;
  while (next) {
    const response: Response = await get(next, { headers: { "x-nitro-prerender": next } });
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

const press = createPress(collection.toSource())
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
  data: { title: "Install", description: "How to install", words: 17 },
  toc: [{ title: "Intro", url: "#intro", depth: 2 }],
  body: { module: "/assets/guide/install.mdx.js" },
};

test("matches route patterns", async () => {
  expect(matchRoute("/sitemap.xml", "/sitemap.xml")).toEqual({});
  expect(matchRoute("/api/[name]", "/api/hello%20there")).toEqual({ name: "hello there" });
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
    press: createPress(collection.toSource()).plugins({
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

test("merges options: the site's own win, then plugins in order, then the defaults", async () => {
  const html = await (await get("/guide/install")).text();
  // by key: the config over the plugin, the plugin over the default from the page
  expect(html).toContain('<meta name="robots" content="all">');
  expect(html).toContain('<meta name="description" content="from the plugin">');
  expect(html).not.toContain('content="How to install"');

  // lists concatenate, and the first defined value wins
  const site: SiteData = await (await get(siteDataPath("en"))).json();
  expect(site.layout).toEqual({
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

  const robots = await (await get("/robots.txt")).text();
  expect(robots).toContain("Sitemap: https://example.com/sitemap.xml");

  const llms = await (await get("/llms.txt")).text();
  expect(llms).toContain("- [Install](https://example.com/guide/install): How to install");

  // the text of a Markdown page comes from its structured data
  const full = await (await get("/llms-full.txt")).text();
  expect(full).toContain("# Install\n\n## Intro\n\nText of guide/install.mdx");
});

test("lists the paths to generate, only for the prerenderer", async () => {
  expect((await get(prerenderListPath(0))).status).toBe(404);
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
  const files = Array.from({ length: 400 }, (_, i) =>
    page(`a-long-folder-name/a-page-with-a-long-name-${i}.mdx`, { title: `Page ${i}` }),
  );
  const large = serve(createPress(createCollection("docs", files).toSource()));
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
  const twice = serve(createPress(collection.toSource()).plugins({ name: "a" }, { name: "a" }));
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
    typeof current.data.html === "string" ? { html: current.data.html } : undefined,
  getPageToc: () => [{ title: "Top", url: "#top", depth: 2 }],
  getPageText: (current) => `# ${current.data.title}`,
  getPageLastModified: () => new Date("2026-01-02T00:00:00Z"),
};
const noteFiles = (): SourceFile[] =>
  Object.entries(notes).map(([path, data]) => ({ type: "page", path, data }));

test("renders the pages of a custom source through content hooks", async () => {
  const custom = serve(
    createPress({ files: noteFiles() })
      .plugins(notesPlugin)
      .config({ site: { baseUrl: "https://example.com" } }),
  );
  const content: PageContent = {
    url: "/first",
    // the date of `getPageLastModified` is in the data too, for the layout
    data: { title: "First", lastModified: "2026-01-02T00:00:00.000Z" },
    toc: [{ title: "Top", url: "#top", depth: 2 }],
    body: { html: "<p>The <b>first</b> note</p>" },
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
      docs: collection.toSource({ baseDir: "docs" }),
      notes: { files: () => noteFiles().map((file) => ({ ...file, path: `notes/${file.path}` })) },
    }).plugins(notesPlugin),
  );
  await mixed("/");
  const ctx = getPressContext();

  expect(ctx.getPage("/docs/guide/install")?.source).toBe("docs");
  expect(ctx.getPage("/notes/first")?.source).toBe("notes");
  expect(ctx.getContentRender("docs")).toBe("static");
  expect(ctx.getContentRender("notes")).toBe("dynamic");

  const { paths } = await prerendered(mixed);
  expect(paths).toContain("/docs/guide/install");
  expect(paths).not.toContain("/notes/first");
});

test("runs build hooks once, and a file they emit is a static route", async () => {
  let runs = 0;
  const built = serve(
    createPress(collection.toSource()).plugins({
      name: "build",
      async build({ paths, emitFile, fetch }) {
        runs++;
        const home = await fetch(new Request("http://localhost/"));
        emitFile("report.json", JSON.stringify({ paths: paths.length, home: home.status }));
      },
    }),
  );

  expect((await built("/report.json")).status).toBe(404);
  expect((await prerendered(built)).paths).toContain("/report.json");
  await prerendered(built);
  expect(runs).toBe(1);
  expect(await (await built("/report.json")).json()).toEqual({ paths: 12, home: 200 });
});

test("adds the loader options of plugins", async () => {
  const seen: string[] = [];
  const configured = serve(
    createPress(collection.toSource(), {
      loaderPlugins: [{ name: "own", config: (config: object) => (seen.push("own"), config) }],
    }).plugins({
      name: "loader",
      configureLoader: () => ({
        plugins: [{ name: "added", config: (config: object) => (seen.push("added"), config) }],
      }),
    }),
  );
  await configured("/");
  expect(seen).toEqual(["own", "added"]);
});

test("generates the not found page for static hosts", async () => {
  // on a server the path has no page, like any other
  expect((await get("/404.html")).status).toBe(404);
  // the prerenderer gets the page, to write the file a static host serves
  const response = await get("/404.html", { headers: { "x-nitro-prerender": "/404.html" } });
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('<div id="app">missing</div>');
});

test("keeps the data a page or an earlier plugin has set", async () => {
  const merged = serve(
    createPress(collection.toSource()).plugins(
      { name: "first", transformPage: () => ({ title: "From the plugin", author: "first" }) },
      { name: "second", transformPage: () => ({ author: "second", reviewer: "second" }) },
    ),
  );
  const content: PageContent = await (await merged("/_press/pages/guide/install.json")).json();
  expect(content.data).toEqual({
    title: "Install",
    description: "How to install",
    author: "first",
    reviewer: "second",
  });
});

test("serves the pages of plugins as views", async () => {
  const posts: Record<string, string> = { hello: "Hello", bye: "Bye" };
  const blog = serve(
    createPress(collection.toSource())
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
            view: ({ slug }) =>
              slug && posts[slug] ? { type: "post", props: { title: posts[slug] } } : undefined,
          });
        },
        // the data of a view is per page here
        transformPage: (data, { page: current, pathname }) =>
          current ? undefined : { title: data.title ?? posts[pathname.split("/").pop()!] },
      })
      .config({ site: { name: "Docs", baseUrl: "https://example.com" } }),
  );

  const content: PageContent = {
    url: "/blog/hello",
    data: { title: "Hello" },
    toc: [],
    body: { view: { type: "post", props: { title: "Hello" } } },
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
  expect(content.body).toEqual({ view: { type: "card", props: { title: "First" } } });
});

const languages = createCollection("docs", [
  page("index.mdx", { title: "Home" }),
  page("index.cn.mdx", { title: "主页" }),
  page("guide/install.mdx", { title: "Install" }),
  page("guide/install.cn.mdx", { title: "安装" }),
  page("guide/english-only.mdx", { title: "English only" }),
]);

function i18nSite(hideLocale: "never" | "default-locale", fallbackLanguage?: null) {
  return serve(
    createPress(languages.toSource(), {
      i18n: defineI18n({
        languages: ["en", "cn"],
        defaultLanguage: "en",
        hideLocale,
        fallbackLanguage,
      }),
    })
      .plugins({
        name: "blog",
        routes({ createView }) {
          createView({
            path: "/blog",
            view: (_params, { lang }) => ({ type: "blog", props: { lang } }),
          });
        },
      })
      .config({
        site: { name: "Docs", baseUrl: "https://example.com" },
        ui: {
          translations: { cn: { displayName: "中文", "Search(search trigger)": "搜索" } },
        },
      }),
  );
}

test("serves each language at its prefix, with its own site data", async () => {
  const site = i18nSite("default-locale", null);

  const html = await (await site("/cn/guide/install")).text();
  expect(html).toContain('<html lang="cn">');
  expect(html).toContain("<title>安装 | Docs</title>");
  expect(html).toContain('<link rel="preload" href="/_press/site/cn.json"');
  expect(html).toContain(
    '<link rel="alternate" hreflang="en" href="https://example.com/guide/install">',
  );
  expect(html).toContain(
    '<link rel="alternate" hreflang="cn" href="https://example.com/cn/guide/install">',
  );
  expect(await (await site("/guide/install")).text()).toContain('<html lang="en">');

  const data: SiteData = await (await site(siteDataPath("cn"))).json();
  expect(data.i18n).toEqual({
    locale: "cn",
    defaultLanguage: "en",
    hideLocale: "default-locale",
    locales: [
      { locale: "en", name: "en" },
      { locale: "cn", name: "中文" },
    ],
    translations: { "Search(search trigger)": "搜索" },
  });
  expect(data.layout.nav).toEqual({ title: "Docs", url: "/cn" });
  expect(data.layout.search?.options).toEqual({ type: "static", api: searchIndexPath("cn") });
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
  expect(view.body).toEqual({ view: { type: "blog", props: { lang: "cn" } } });
  expect((await prerendered(site)).paths).toEqual(
    expect.arrayContaining(["/blog", "/cn/blog", "/cn", "/_press/site/cn.json", "/cn/llms.txt"]),
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

test("refuses to hide every language", async () => {
  const hidden = serve(
    createPress(languages.toSource(), {
      i18n: { languages: ["en"], defaultLanguage: "en", hideLocale: "always" as never },
    }),
  );
  await expect(hidden("/")).rejects.toThrow('`hideLocale: "always"` is not supported');
});
