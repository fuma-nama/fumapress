import { createPress, type Source } from "@fumapress/vue/config";
import { defineCollections, defineDocs } from "@fumapress/vue/content";
import { defineI18n, uiTranslations } from "@fumapress/vue/i18n";
import { pageSchema } from "@fumapress/vue/schema";
import { z } from "zod";

// the pages of `content/`, dated by the last commit of their file
const docs = defineDocs({ dir: "content", docs: { lastModified: true } });

// the posts of `blog/`: the schema checks their frontmatter, and types `page.data`
const blog = defineCollections({
  type: "doc",
  dir: "blog",
  schema: pageSchema.extend({ date: z.string(), tags: z.array(z.string()).default([]) }),
});

const releases = [
  { version: "0.2.0", notes: "<p>Custom content sources, and the <code>build</code> hook.</p>" },
  { version: "0.1.0", notes: "<p>The first release.</p>" },
];

// a custom source: its pages come from anywhere, here from a list in this file. Its type gives `page.data` its fields.
const changelog: Source<{
  pageData: { title: string; description: string; html: string };
  metaData: {};
}> = {
  files: releases.map(({ version, notes }) => ({
    type: "page",
    path: `changelog/${version}.md`,
    data: { title: `v${version}`, description: "Release notes", html: notes },
  })),
};

// `page.cn.mdx` is the Chinese version of `page.mdx`: a page without one shows the English page
const i18n = defineI18n({
  languages: ["en", "cn"],
  defaultLanguage: "en",
  hideLocale: "default-locale",
});

export default createPress(
  { docs: docs.toFumadocsSource(), blog: blog.toFumadocsSource({ baseDir: "blog" }), changelog },
  { i18n },
)
  .plugins({
    name: "site:changelog",
    // renders the pages of the `changelog` source through content hooks
    getPageBody(page) {
      if (page.type === "changelog") return { html: page.data.html };
    },
    getPageText(page) {
      if (page.type === "changelog") return `# ${page.data.title}`;
    },
    routes({ createApi }) {
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
  })
  .views({
    // a page of the site: the `releases` view of the theme renders it, with these props
    releases: {
      path: "/releases",
      data: { title: "Releases" },
      view({ lang }) {
        const pages = this.getPages(lang).flatMap((page) =>
          page.type === "changelog" ? [{ title: page.data.title, url: page.url }] : [],
        );
        return { releases: pages };
      },
    },
    // the posts of the blog, newest first, with the fields of their schema
    "blog.index": {
      path: "/blog",
      data: { title: "Blog" },
      view({ lang }) {
        const posts = this.getPages(lang).flatMap((page) =>
          page.type === "blog"
            ? [
                {
                  title: page.data.title,
                  url: page.url,
                  date: page.data.date,
                  tags: page.data.tags,
                },
              ]
            : [],
        );
        return { posts: posts.sort((a, b) => b.date.localeCompare(a.date)) };
      },
    },
  })
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
            { text: lang === "cn" ? "博客" : "Blog", url: this.localizePath(lang, "/blog") },
            { text: "About", url: "/about" },
          ],
        };
      },
      // a key is the English text, with the note that tells its uses apart
      translations: i18n
        .translations()
        .extend(uiTranslations())
        .add({
          en: { displayName: "English" },
          cn: {
            displayName: "中文",
            "Search(search trigger)": "搜索",
            "Search(search dialog)": "搜索",
            "On this page(table of contents)": "本页内容",
            "Edit on GitHub(edit page)": "在 GitHub 上编辑",
          },
        }),
    },
  });
