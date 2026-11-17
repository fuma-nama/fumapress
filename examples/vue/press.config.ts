import { createPress, defineI18n, type Plugin } from "@fumapress/vue/config";
import { collections } from "@fumapress/vue/content";

// a custom source: its pages come from anywhere, here from a list in this file
const releases = [
  { version: "0.2.0", notes: "<p>Custom content sources, and the <code>build</code> hook.</p>" },
  { version: "0.1.0", notes: "<p>The first release.</p>" },
];

/** renders the pages of the `changelog` source through content hooks, and lists them on a page of its own */
const changelogPlugin: Plugin = {
  name: "site:changelog",
  getPageBody(page) {
    if (page.source === "changelog") return { html: String(page.data.html) };
  },
  getPageText(page) {
    if (page.source === "changelog") return `# ${page.data.title}`;
  },
  routes({ createApi, createView }) {
    // a page of the plugin: the `releases` view of the theme renders it
    createView({
      path: "/releases",
      data: { title: "Releases" },
      view: ({ lang }) => ({
        type: "releases",
        props: {
          releases: this.getPages(lang)
            .filter((page) => page.source === "changelog")
            .map((page) => ({ title: page.data.title, url: page.url })),
        },
      }),
    });
    // an API route of the plugin
    createApi({
      path: "/api/pages",
      GET: () => Response.json(this.getPages().map((page) => page.url)),
    });
  },
  // a header on every response the server sends
  async middleware(_request, next) {
    const response = await next();
    const out = new Response(response.body, response);
    out.headers.set("x-powered-by", "fumapress");
    return out;
  },
  // a file written when the site is built
  build({ paths, emitFile }) {
    emitFile("build.json", JSON.stringify({ pages: paths.length }));
  },
};

export default createPress(
  {
    docs: collections.docs!.toSource(),
    changelog: {
      files: releases.map(({ version, notes }) => ({
        type: "page",
        path: `changelog/${version}.md`,
        data: { title: `v${version}`, description: "Release notes", html: notes },
      })),
    },
  },
  {
    // `page.cn.mdx` is the Chinese version of `page.mdx`: a page without one shows the English page
    i18n: defineI18n({
      languages: ["en", "cn"],
      defaultLanguage: "en",
      hideLocale: "default-locale",
    }),
  },
)
  .plugins(changelogPlugin)
  .config({
    site: {
      name: "Fumapress Vue",
      description: "A docs site on Vue, built with Fumapress.",
      baseUrl: "https://example.com",
      git: { user: "fuma-nama", repo: "fumapress", branch: "dev", dir: "examples/vue" },
    },
    ui: {
      layoutProps({ lang }) {
        return {
          links: [
            { text: lang === "cn" ? "文档" : "Docs", url: this.localizePath(lang, "/") },
            {
              text: lang === "cn" ? "版本" : "Releases",
              url: this.localizePath(lang, "/releases"),
            },
            { text: "About", url: "/about" },
          ],
        };
      },
      translations: {
        en: { displayName: "English" },
        // a key is the English text, with the note that tells its uses apart
        cn: {
          displayName: "中文",
          "Search(search trigger)": "搜索",
          "Search(search dialog)": "搜索",
          "On this page(table of contents)": "本页内容",
          "Edit on GitHub(edit page)": "在 GitHub 上编辑",
        },
      },
    },
  });
