import { expectTypeOf, test } from "vitest";
import { defineComponent, h, type Component, type PropType } from "vue";
import { usePage, type PageData, type PageOf as ClientPageOf } from "@fumapress/vue/client";
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
  type ViewEnv,
} from "@fumapress/vue/config";
import {
  defineCollections,
  defineDocs,
  type DefaultMetaData,
  type DefaultPageData,
} from "@fumapress/vue/content";
import { defineI18n, defineTranslations, uiTranslations } from "@fumapress/vue/i18n";
import { metaSchema, pageSchema } from "@fumapress/vue/schema";
import { baseTheme, defineTheme } from "@fumapress/vue/theme";
import defaultTheme from "@fumapress/vue/theme/default";
import DocsLayout from "@fumapress/vue/theme/layouts/docs";
import GlassLayout from "@fumapress/vue/theme/layouts/glass";
import NotebookLayout from "@fumapress/vue/theme/layouts/notebook";
import { z } from "zod";

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
      layoutProps: { links: [{ text: "Blog", url: "/blog" }] },
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
  // @ts-expect-error: the theme picks the layout
  site.config({ ui: { layout: "notebook" } });
  // @ts-expect-error: the config has the props every layout shares, the theme the others
  site.config({ ui: { layoutProps: { tabMode: "navbar" } } });
  // @ts-expect-error: the props of the page are in the theme
  site.config({ ui: { pageProps: { full: true } } });
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

  expectTypeOf<Index["pageData"]>().toEqualTypeOf<PageData>();

  // a content page: its frontmatter as JSON, its page data, its table of contents and its content
  type Post = PageOf<typeof app, "blog">;
  expectTypeOf<Post["type"]>().toEqualTypeOf<"blog">();
  expectTypeOf<Post["data"]>().toEqualTypeOf<{ title: string; date: string; tags: string[] }>();
  expectTypeOf<Post["pageData"]>().toEqualTypeOf<PageData>();
  expectTypeOf<Post["Content"]>().toEqualTypeOf<Component>();
  // @ts-expect-error: a content page has no props without a plugin rendering it as a view
  void ({} as Post).props;
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

// The macros run compiled, in `press.config`: these sites are only read for their types.
function collections() {
  const docs = defineDocs({ dir: "content/docs" });
  const posts = defineCollections({
    type: "doc",
    dir: "content/blog",
    schema: pageSchema.extend({ date: z.string(), tags: z.array(z.string()) }),
    lastModified: true,
  });
  const app = createPress({
    docs: docs.toFumadocsSource(),
    blog: posts.toFumadocsSource({ baseDir: "blog" }),
  }).config({});
  return { docs, posts, app };
}

test("the schemas of collections type `page.data`, with no annotation", () => {
  type App = ReturnType<typeof collections>["app"];
  type Page = NonNullable<App["~types"]>["content"]["page"];
  function read(page: Page) {
    if (page.type === "blog") {
      expectTypeOf(page.data.date).toEqualTypeOf<string>();
      expectTypeOf(page.data.tags).toEqualTypeOf<string[]>();
      // with `lastModified: true`
      expectTypeOf(page.data.lastModified).toEqualTypeOf<Date | undefined>();
    } else {
      // the built-in schema has the fields of `pageSchema`
      expectTypeOf(page.data).toEqualTypeOf<DefaultPageData>();
      // @ts-expect-error: a collection without `lastModified: true` has no date
      void page.data.lastModified;
    }
  }
  void read;

  // the built-in schemas give the types of the ones of Fumadocs
  expectTypeOf<DefaultPageData>().toEqualTypeOf<z.output<typeof pageSchema>>();
  expectTypeOf<DefaultMetaData>().toEqualTypeOf<z.output<typeof metaSchema>>();
  type Meta = NonNullable<App["~types"]>["content"]["meta"];
  expectTypeOf<Extract<Meta, { type: "docs" }>["data"]>().toEqualTypeOf<DefaultMetaData>();

  // as JSON in the browser: a `Date` is a string
  expectTypeOf<PageOf<App, "blog">["data"]["lastModified"]>().toEqualTypeOf<string | undefined>();
});

test("a collection takes the options of its macro only", () => {
  function options() {
    // @ts-expect-error: an option of `fumadocs-mdx` that doesn't exist here
    defineDocs({ docs: { async: true } });
    // @ts-expect-error: compile options are those of the Vite plugin, for every file
    defineDocs({ docs: { mdxOptions: {} } });
    // @ts-expect-error: a dynamic collection is a source of its own
    defineDocs({ docs: { dynamic: true } });
    // @ts-expect-error: not an option of a collection
    defineCollections({ type: "doc", dir: "blog", postprocess: {} });
    // @ts-expect-error: a collection has a folder
    defineCollections({ type: "doc" });
    // @ts-expect-error: the frontmatter of a page must fit `PageData`, like a title that is text
    defineDocs({ docs: { schema: z.object({ title: z.number() }) } });
  }
  void options;
});

test("the content of a site is sources: a collection is one through `toFumadocsSource()`", () => {
  function content() {
    const { docs } = collections();
    // @ts-expect-error: a collection, not its source
    createPress(docs);
    // @ts-expect-error: not a source
    createPress({ docs: { pages: [] } });
    // a source of its own, in a folder
    createPress({ notes: { baseDir: "notes", files: [] } });
  }
  void content;
});

test("the data of the pages of a view can come from its params and props", () => {
  site.views({
    "blog.tag": {
      path: "/blog/tags/[tag]",
      staticPaths: ["news"],
      view: ({ params }) => ({ tag: params.tag ?? "" }),
      data: ({ params, lang }) => {
        expectTypeOf(lang).toEqualTypeOf<"en" | "cn">();
        return { title: `Posts tagged ${params.tag}` };
      },
    },
  });
  // TypeScript infers the props `data` receives when the parameter of `view` is annotated or absent
  site.views({
    "blog.count": {
      path: "/blog/count",
      view: (env: ViewEnv<"en" | "cn">) => ({ count: env.lang.length }),
      data: ({ props }) => {
        expectTypeOf(props).toEqualTypeOf<{ count: number }>();
        return { title: `${props.count} posts` };
      },
    },
  });
});

/** a site with one source and no views */
const single = createPress(docs).config({});

/** a component whose one prop is the page of the type `K` of the test site */
function viewOf<K extends PressPageType<typeof app>>() {
  return defineComponent({
    props: { page: { type: Object as PropType<PageOf<typeof app, K>>, required: true } },
    setup: () => () => null,
  });
}

test("a theme gives each page type of the site a component that receives its pages", () => {
  const Post = viewOf<"blog">();
  const Index = viewOf<"blog.index">();
  const Releases = viewOf<"releases">();
  // a functional component and a function importing the component check the page the same way
  const Docs = (props: { page: PageOf<typeof app, "docs"> }) => h("p", props.page.url);
  Docs.props = ["page"];
  const lazyIndex = async () => ({ default: Index });

  defineTheme<typeof app>({
    extends: defaultTheme,
    views: { blog: Post, docs: Docs, "blog.index": lazyIndex, releases: Releases },
  });
  // the built-in UI renders any content page
  defineTheme<typeof app>({
    extends: defaultTheme,
    views: { default: DocsLayout, docs: DocsLayout, "blog.index": Index, releases: Releases },
  });

  defineTheme<typeof app>({
    extends: defaultTheme,
    // @ts-expect-error: not a page type of the site
    views: { "blog.post": Post, "blog.index": Index, releases: Releases },
  });
  // @ts-expect-error: the view `releases` has no component
  defineTheme<typeof app>({ extends: defaultTheme, views: { "blog.index": Index } });
  // @ts-expect-error: a view without a component, with no theme to build on
  defineTheme<typeof app>({ views: { "blog.index": Index } });
  defineTheme<typeof app>({
    extends: defaultTheme,
    // @ts-expect-error: the component of the posts of the blog receives a view of releases
    views: { blog: Releases, "blog.index": Index, releases: Releases },
  });
  defineTheme<typeof app>({
    extends: defaultTheme,
    // @ts-expect-error: the same, imported by a function
    views: { "blog.index": async () => ({ default: Releases }), releases: Releases },
  });
  defineTheme<typeof app>({
    extends: defaultTheme,
    // @ts-expect-error: the built-in UI renders content pages, not views
    views: { "blog.index": DocsLayout, releases: Releases },
  });

  // a theme whose views have components for the page types of the site satisfies them
  const plugin = { views: { default: DocsLayout, releases: Releases } };
  defineTheme<typeof app>({ extends: plugin, views: { "blog.index": Index } });
  defineTheme<typeof app>({
    extends: { views: { default: DocsLayout, releases: Releases, "blog.index": Index } },
  });
  // @ts-expect-error: a theme without the component of `blog.index`
  defineTheme<typeof app>({ extends: plugin });

  // content pages need their own component or `views.default`, which the base theme doesn't have
  // @ts-expect-error: no component for the pages of `docs` and `blog`
  defineTheme<typeof app>({
    extends: baseTheme,
    views: { "blog.index": Index, releases: Releases },
  });
  defineTheme<typeof app>({
    extends: baseTheme,
    views: { docs: Docs, blog: Post, "blog.index": Index, releases: Releases },
  });

  // a theme of a site without views needs a component for its content pages, and checks nothing without the type
  // of the site
  defineTheme<typeof single>({ views: { default: DocsLayout } });
  // @ts-expect-error: no component for the content pages
  defineTheme<typeof single>({ extends: baseTheme });
  defineTheme<typeof single>({ extends: defaultTheme });
  defineTheme({ views: { anything: Post } });
});

/** the props of a component that is a function, like a `.vue` file with `generic` */
type PropsOf<C extends (props: never) => unknown> = Parameters<C>[0];

test("the options of the built-in UI are typed by its layout", () => {
  const page = {} as PageOf<typeof app, "docs">;
  const ofDocs: PropsOf<typeof DocsLayout> = { page, layoutProps: { tabMode: "top" } };
  const ofNotebook: PropsOf<typeof NotebookLayout> = {
    page,
    layoutProps: { tabMode: "navbar", nav: { mode: "top" } },
    pageProps: { tableOfContentPopover: { enabled: false } },
  };
  // @ts-expect-error: a prop of the notebook layout, on the docs layout
  const wrong: PropsOf<typeof DocsLayout> = { page, layoutProps: { tabMode: "navbar" } };
  const ofGlass: PropsOf<typeof GlassLayout> = {
    page,
    // @ts-expect-error: the page of the glass layout has no breadcrumb
    pageProps: { breadcrumb: {} },
  };
  // components and functions, which the config can't hold
  const slots: PropsOf<typeof DocsLayout> = {
    page,
    layoutProps: { nav: { title: defineComponent(() => () => h("b", "Press")) } },
  };
  void [ofDocs, ofNotebook, wrong, ofGlass, slots];

  // the base theme with another layout for content pages
  defineTheme<typeof app>({
    extends: baseTheme,
    views: {
      default: NotebookLayout,
      "blog.index": viewOf<"blog.index">(),
      releases: viewOf<"releases">(),
    },
  });
});

test("`usePage()` narrows by the type of the page", () => {
  function read() {
    const page = usePage<typeof app>().value;
    if (page?.type === "blog") {
      expectTypeOf(page.data.tags).toEqualTypeOf<string[]>();
      expectTypeOf(page.Content).toEqualTypeOf<Component>();
    } else if (page?.type === "blog.index") {
      expectTypeOf(page.props.posts).toEqualTypeOf<({ url: string; date: string } | null)[]>();
    }
    // the page of any site
    expectTypeOf(usePage().value?.pageData).toEqualTypeOf<PageData | undefined>();
  }
  void read;
});
