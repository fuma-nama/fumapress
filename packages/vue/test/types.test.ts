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

test("languages are told apart by their URL", () => {
  defineI18n({ languages: ["en", "cn"], defaultLanguage: "en", hideLocale: "default-locale" });
  // @ts-expect-error: a site never hides every language
  defineI18n({ languages: ["en", "cn"], defaultLanguage: "en", hideLocale: "always" });
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
    // @ts-expect-error: `meta.json` files are in the collections of `defineDocs()`
    defineCollections({ type: "meta", dir: "meta" });

    // an unknown option is one error, and the collection keeps its types
    const posts = defineCollections({
      type: "doc",
      dir: "blog",
      schema: pageSchema.extend({ date: z.string() }),
      // @ts-expect-error: not an option of a collection
      async: true,
    });
    const source = posts.toFumadocsSource();
    expectTypeOf(source.files[0]!).toExtend<{ type: "page" | "meta" }>();
    const site = createPress({ posts: source });
    type Page = NonNullable<(typeof site)["~types"]>["content"]["page"];
    expectTypeOf<Page["data"]["date"]>().toEqualTypeOf<string>();
  }
  void options;
});

// a plugin module adds the fields of the page data it sets
declare module "@fumapress/vue/config" {
  interface PageData {
    readingTime?: number;
  }
}

test("the page data has the fields core and plugins declare", () => {
  site.plugins({ name: "reading-time", transformPage: () => ({ readingTime: 2 }) });
  // @ts-expect-error: a field no plugin declares
  site.plugins({ name: "typo", transformPage: () => ({ titel: "Home" }) });
  site.views({
    // @ts-expect-error: a misspelled field of the data of a view
    about: { path: "/about", data: { titel: "About" }, view: () => ({}) },
  });
  // @ts-expect-error: the same in the options of a custom page
  defineComponent({ page: { titel: "About" } });
  // the type of the browser is the same one
  const ofClient: PageData = { title: "About", readingTime: 1 };
  void ofClient;
});

test("a view has its own name, not the key of a source", () => {
  // @ts-expect-error: the theme renders both with `views.docs`
  site.views({ docs: { path: "/docs-index", view: () => ({}) } });
});

test("a plugin renders the pages of a source it declares as views", () => {
  const cards = <C extends AppShape>(): Plugin<C, { pages: { docs: { title: string } } }> => ({
    name: "test:cards",
    getPageBody: (page) => ({ view: { props: { title: page.url } } }),
  });
  void cards;
  const wrong = <C extends AppShape>(): Plugin<C, { pages: { docs: { title: string } } }> => ({
    name: "test:wrong",
    // @ts-expect-error: the props of another page type
    getPageBody: () => ({ view: { props: { count: 1 } } }),
  });
  void wrong;
  const untyped: Plugin = {
    name: "test:untyped",
    // @ts-expect-error: a plugin without declared pages renders none as a view
    getPageBody: () => ({ view: { props: {} } }),
  };
  void untyped;

  // written in `.plugins()`: the theme would have no component for its pages
  // @ts-expect-error: the plugin "inline" returns views of pages it doesn't declare
  site.plugins({ name: "inline", getPageBody: () => ({ view: { props: { title: "" } } }) });
  // other bodies, and typed plugins, are fine
  site.plugins(
    { name: "html", getPageBody: () => ({ html: "<p>Hi</p>" }) },
    releasesPlugin(),
    cards(),
  );
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

test("the props of views are inferred next to static data and data from params", () => {
  // every way to write `view` in one call: methods using `this`, arrow functions, with or without a parameter
  const views = site.views({
    "blog.tag": {
      path: "/blog/tags/[tag]",
      staticPaths: ["news"],
      view: ({ params }) => ({ tag: params.tag ?? "" }),
      data: ({ params, lang }) => {
        expectTypeOf(lang).toEqualTypeOf<"en" | "cn">();
        return { title: `Posts tagged ${params.tag}` };
      },
    },
    "blog.count": {
      path: "/blog/count",
      view({ lang }) {
        return { count: this.getPages(lang).length };
      },
      data: { title: "Count" },
    },
    "blog.year": {
      path: "/blog/years/[year]",
      staticPaths: ["2026"],
      view({ params }) {
        return { year: Number(params.year), pages: this.getPages().length };
      },
      data({ params }) {
        return { title: `Posts of ${params.year}`, description: this.site.name };
      },
    },
    "blog.all": { path: "/blog/all", view: (env: ViewEnv) => ({ lang: env.lang }) },
  });
  type Views = typeof views;
  expectTypeOf<PageOf<Views, "blog.tag">["props"]>().toEqualTypeOf<{ tag: string }>();
  expectTypeOf<PageOf<Views, "blog.count">["props"]>().toEqualTypeOf<{ count: number }>();
  expectTypeOf<PageOf<Views, "blog.year">["props"]>().toEqualTypeOf<{
    year: number;
    pages: number;
  }>();
  expectTypeOf<PageOf<Views, "blog.all">["props"]>().toEqualTypeOf<{ lang: string }>();

  site.views({
    "blog.tag": {
      path: "/blog/tags/[tag]",
      view: ({ params }) => ({ tag: params.tag }),
      // @ts-expect-error: the page data of a view comes from its params, not from its props
      data: ({ props }) => ({ title: props.tag }),
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

  // the components of views are in the theme's own `views`: the ones of another theme are spread there
  const plugin = { views: { releases: Releases } };
  defineTheme<typeof app>({
    extends: [defaultTheme, plugin],
    views: { ...plugin.views, "blog.index": Index },
  });
  // @ts-expect-error: `extends` doesn't count, so `releases` has no component
  defineTheme<typeof app>({ extends: [defaultTheme, plugin], views: { "blog.index": Index } });
  // @ts-expect-error: a theme without `views` has no component for the views
  defineTheme<typeof app>({ extends: defaultTheme });

  // a content type has its own component or `views.default`, here or in a theme it extends: the site checks it
  // when it starts
  defineTheme<typeof app>({
    extends: baseTheme,
    views: { "blog.index": Index, releases: Releases },
  });
  defineTheme<typeof app>({
    extends: baseTheme,
    views: { docs: Docs, blog: Post, "blog.index": Index, releases: Releases },
  });

  // a site without views needs no `views` in its types, and nothing is checked without the type of the site
  defineTheme<typeof single>({ views: { default: DocsLayout } });
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
