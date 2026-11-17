import { expectTypeOf, test } from "vitest";
import type { Component } from "vue";
import type { PageOf as ClientPageOf } from "@fumapress/vue/client";
import {
  createPress,
  recommendedPreset,
  type AppShape,
  type Context,
  type PageOf,
  type Plugin,
  type PressContext,
  type PressLang,
  type PressPageType,
  type Source,
  type SourcePage,
} from "@fumapress/vue/config";
import { defineI18n, defineTranslations, uiTranslations } from "@fumapress/vue/i18n";

// The guarantees of the types of the builder, read from the declarations of the build like a site reads them: a
// `@ts-expect-error` without an error fails `types:check`.

interface DocsData {
  title: string;
  description?: string;
}
interface BlogData {
  title: string;
  date: Date;
  tags: string[];
}

const docs: Source<{ pageData: DocsData; metaData: { title?: string } }> = { files: [] };
const blog: Source<{ pageData: BlogData; metaData: { title?: string } }> = { files: () => [] };
const i18n = defineI18n({ languages: ["en", "cn"], defaultLanguage: "en" });

interface ReleaseProps {
  releases: { version: string; date: Date }[];
}

/** a typed plugin factory: its views are in the site's types, and it gets the site's pages */
function releasesPlugin<C extends AppShape>(): Plugin<C, { views: { releases: ReleaseProps } }> {
  return {
    name: "test:releases",
    routes({ createView }) {
      createView({
        path: "/releases",
        view: () => ({ type: "releases", props: { releases: [] } }),
      });
    },
  };
}

const site = createPress({ docs, blog }, { i18n });
const app = site
  .plugins(releasesPlugin())
  .views({
    "blog.index": {
      path: "/blog",
      view({ lang }) {
        expectTypeOf(lang).toEqualTypeOf<"en" | "cn">();
        const posts = this.getPages(lang).filter((page) => page.type === "blog");
        return {
          posts: posts.map((page) =>
            page.type === "blog" ? { url: page.url, date: page.data.date } : undefined,
          ),
        };
      },
    },
  })
  .config({
    preset: recommendedPreset({
      // the pages of the site
      sitemap: { filter: (page) => page.type !== "blog" || page.data.tags.length > 0 },
    }),
    ui: {
      layout: "notebook",
      layoutProps: { tabMode: "navbar", links: [{ text: "Blog", url: "/blog" }] },
      pageProps: { tableOfContent: { style: "clerk" } },
      translations: i18n
        .translations()
        .extend(uiTranslations())
        .add({ cn: { "Search(search trigger)": "搜索", displayName: "中文" } }),
    },
  });

test("the page data narrows by the type of a page", () => {
  type Page = (typeof app)["~types"] extends { content: infer C extends AppShape } | undefined
    ? C["page"]
    : never;
  expectTypeOf<Page["type"]>().toEqualTypeOf<"docs" | "blog">();
  expectTypeOf<
    SourcePage<NonNullable<(typeof app)["~types"]>["content"], "blog">["data"]
  >().toEqualTypeOf<BlogData>();

  function read(page: Page) {
    if (page.type === "blog") expectTypeOf(page.data).toEqualTypeOf<BlogData>();
    else expectTypeOf(page.data).toEqualTypeOf<DocsData>();
  }
  void read;
});

test("languages are the site's", () => {
  expectTypeOf<PressLang<typeof app>>().toEqualTypeOf<"en" | "cn">();
  function check(ctx: PressContext<typeof app>) {
    ctx.localizePath("cn", "/");
    // @ts-expect-error: not a language of the site
    ctx.localizePath("fr", "/");
    expectTypeOf(ctx.languages).toEqualTypeOf<readonly ("en" | "cn")[]>();
  }
  void check;

  site.config({
    ui: {
      // @ts-expect-error: the translations of other languages
      translations: defineI18n({ languages: ["en", "fr"], defaultLanguage: "en" }).translations(),
    },
  });
  // @ts-expect-error: a language the site doesn't have
  i18n.translations().add({ fr: {} });
  const ui = i18n.translations().extend(uiTranslations());
  // @ts-expect-error: a key the translations don't have
  ui.add({ cn: { "Not a key": "" } });

  // a site without languages takes the singular API only
  const single = createPress(docs);
  expectTypeOf<PressLang<typeof single>>().toEqualTypeOf<string>();
  single.config({ ui: { translations: defineTranslations().extend(uiTranslations()) } });
  // @ts-expect-error: the API of languages on a site without them
  single.config({ ui: { translations: i18n.translations() } });
});

test("unknown keys are type errors", () => {
  // @ts-expect-error: not a hook
  site.plugins({ name: "a", getPageBodyy() {} });
  // @ts-expect-error: not a content option
  createPress(docs, { unknown: true });
  // @ts-expect-error: the plugins of the site go in `.plugins()`
  createPress(docs, { plugins: [] });
  // @ts-expect-error: not a layout
  site.config({ ui: { layout: "book" } });
  // @ts-expect-error: a prop of the notebook layout, on the docs layout
  site.config({ ui: { layoutProps: { tabMode: "navbar" } } });
});

test("a plugin returns the views it declares", () => {
  const typed = <C extends AppShape>(): Plugin<C, { views: { a: { count: number } } }> => ({
    name: "test:a",
    routes({ createView }) {
      createView({ path: "/a", view: () => ({ type: "a", props: { count: 1 } }) });
      // @ts-expect-error: a view type it doesn't declare
      createView({ path: "/b", view: () => ({ type: "b", props: { count: 1 } }) });
      // @ts-expect-error: the props of another type
      createView({ path: "/c", view: () => ({ type: "a", props: { count: "1" } }) });
    },
  });
  void typed;

  const untyped: Plugin = {
    name: "test:untyped",
    routes({ createView }) {
      // @ts-expect-error: a plugin without declared views has none
      createView({ path: "/a", view: () => ({ type: "a", props: {} }) });
    },
  };
  void untyped;
});

test("the views of the site and of its plugins reach `PageOf`", () => {
  expectTypeOf<PressPageType<typeof app>>().toEqualTypeOf<
    "docs" | "blog" | "releases" | "blog.index"
  >();

  type Index = PageOf<typeof app, "blog.index">;
  expectTypeOf<Index["type"]>().toEqualTypeOf<"blog.index">();
  // as JSON: a `Date` is a string
  expectTypeOf<Index["props"]>().toEqualTypeOf<{
    posts: ({ url: string; date: string } | null)[];
  }>();
  expectTypeOf<PageOf<typeof app, "releases">["props"]>().toEqualTypeOf<{
    releases: { version: string; date: string }[];
  }>();

  type Post = PageOf<typeof app, "blog">;
  expectTypeOf<Post["data"]>().toEqualTypeOf<{ title: string; date: string; tags: string[] }>();
  expectTypeOf<Post["Content"]>().toEqualTypeOf<Component>();
  expectTypeOf<ClientPageOf<typeof app, "docs">>().toEqualTypeOf<PageOf<typeof app, "docs">>();

  // @ts-expect-error: no view of this name
  expectTypeOf<PageOf<typeof app, "blog.post">>().toBeNever();
});

test("the context of the site", () => {
  expectTypeOf<PressContext<typeof app>>().toEqualTypeOf<
    Context<NonNullable<(typeof app)["~types"]>["content"]>
  >();
  function render(ctx: PressContext<typeof app>) {
    expectTypeOf(ctx.getContentRender)
      .parameter(0)
      .toEqualTypeOf<"docs" | "blog" | readonly ("docs" | "blog")[] | undefined>();
    // @ts-expect-error: not a source key
    ctx.getContentRender("notes");
  }
  void render;
});
