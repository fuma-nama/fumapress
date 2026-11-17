// The app of a site with one of the layouts of the UI for its content pages, built like `createPressApp()` of
// `runtime/app.ts`, which can't be imported as it is: it reads the theme and the routes from the virtual modules of
// the Vite plugin. The same module runs on the server (`render-layouts.ts`) and in the browser
// (`ui-layouts.test.ts`), so both render the same data.
import { createSSRApp, defineComponent, h } from "vue";
import {
  PageView,
  RouterView,
  createPressState,
  createRouter,
  loadPage,
  pressKey,
  routerKey,
  type ContentPage,
  type Load,
  type Theme,
} from "@fumapress/vue/client";
import { pageDataPath, siteDataPath } from "../../src/core/routes";
import type { PageContent, SiteData } from "../../src/core/types";
import { baseTheme } from "../../theme";
import defaultTheme from "../../theme/default";
import FluxLayout from "../../theme/layouts/Flux.vue";
import GlassLayout from "../../theme/layouts/Glass.vue";
import NotebookLayout from "../../theme/layouts/Notebook.vue";
import SpaciousLayout from "../../theme/layouts/Spacious.vue";
import { Languages } from "../../ui/icons";
import HomeLayout from "../../theme/layouts/Home.vue";

/** a nested page, so the sidebar opens folders and the breadcrumb has items */
export const PAGE_URL = "/docs/configure/theme";

export const site: SiteData = {
  site: { name: "Press", description: "Docs of Press" },
  dir: "ltr",
  layoutProps: {
    nav: { title: "Press", url: "/" },
    links: [
      { text: "Blog", url: "/blog" },
      { text: "Fumadocs", url: "https://fumadocs.dev", external: true },
    ],
    githubUrl: "https://github.com/fuma-nama/fumapress",
    search: { enabled: true, options: { type: "static" } },
  },
  // with the `$id` of every node, like the trees of the loader: tabs are matched by it
  tree: {
    $id: "root",
    name: "Docs",
    children: [
      {
        $id: "guide",
        type: "folder",
        name: "Guide",
        description: "Learn Press",
        // a root folder is a tab; the name of an icon of the theme becomes its component
        root: true,
        icon: "Languages",
        index: { $id: "guide/index.mdx", type: "page", name: "Introduction", url: "/docs" },
        children: [
          { $id: "guide/separator", type: "separator", name: "Getting started" },
          // an icon without a component of the theme stays text, like an emoji
          {
            $id: "guide/install.mdx",
            type: "page",
            name: "Install",
            url: "/docs/install",
            icon: "📦",
          },
          {
            $id: "guide/configure",
            type: "folder",
            name: "Configure",
            index: {
              $id: "guide/configure/index.mdx",
              type: "page",
              name: "Configure",
              url: "/docs/configure",
            },
            children: [
              {
                $id: "guide/configure/theme.mdx",
                type: "page",
                name: "Theme",
                url: "/docs/configure/theme",
              },
            ],
          },
          {
            $id: "guide/source",
            type: "page",
            name: "Source code",
            url: "https://github.com/fuma-nama/fumapress",
            external: true,
          },
        ],
      },
      {
        $id: "api",
        type: "folder",
        name: "API",
        root: true,
        children: [{ $id: "api/index.mdx", type: "page", name: "Reference", url: "/api" }],
      },
    ],
  },
};

export const page: PageContent = {
  url: PAGE_URL,
  data: { title: "Theme", description: "Change the colors of the site." },
  pageData: {
    title: "Theme",
    description: "Change the colors of the site.",
    githubUrl: "https://github.com/fuma-nama/fumapress/blob/dev/content/theme.mdx",
    lastModified: "2026-01-02T00:00:00.000Z",
  },
  toc: [
    { title: "Colors", url: "#colors", depth: 2 },
    { title: "Dark mode", url: "#dark-mode", depth: 3 },
  ],
  body: {
    html: '<h2 id="colors">Colors</h2><p>Pick a color.</p><h3 id="dark-mode">Dark mode</h3><p>It follows the system.</p>',
  },
  head: { title: "Theme" },
};

/** the URL of a view of the site, in the home layout */
export const VIEW_URL = "/blog";

const view: PageContent = {
  url: VIEW_URL,
  type: "blog.index",
  props: { posts: ["Hello"] },
  pageData: { title: "Blog" },
  head: { title: "Blog" },
};

const Home = defineComponent({
  props: { page: Object },
  setup() {
    return () => h(HomeLayout, null, () => h("h1", "Press"));
  },
});

/** a component of `views` that wraps the notebook layout with options of the theme, over the config's */
const ThemeNotebook = defineComponent({
  props: { page: { type: Object as () => ContentPage, required: true } },
  setup(props) {
    return () =>
      h(NotebookLayout, {
        page: props.page,
        layoutProps: { tabMode: "navbar", nav: { title: "From the theme" } },
      });
  },
});

const icons = { Languages };
const views = { "blog.index": Home };

/**
 * The sites to render: the base theme with each layout for content pages, a component of `views` wrapping a layout
 * with options over the config's, and a view in the home layout.
 */
export const cases = {
  docs: { extends: defaultTheme, icons, views },
  notebook: { extends: baseTheme, icons, views: { ...views, default: NotebookLayout } },
  glass: { extends: baseTheme, icons, views: { ...views, default: GlassLayout } },
  spacious: { extends: baseTheme, icons, views: { ...views, default: SpaciousLayout } },
  flux: { extends: baseTheme, icons, views: { ...views, default: FluxLayout } },
  theme: { extends: baseTheme, icons, views: { default: ThemeNotebook } },
  home: { extends: baseTheme, icons, views: { default: Home } },
} satisfies Record<string, Theme>;

export type CaseName = keyof typeof cases;

export async function createTestApp(name: CaseName, url = PAGE_URL) {
  const theme = cases[name];
  // the data routes the app reads: the server answers them, the browser receives them with the document
  const load: Load = async <T>(path: string) => {
    if (path === siteDataPath("en")) return site as T;
    if (path === pageDataPath(PAGE_URL)) return page as T;
    if (path === pageDataPath(VIEW_URL)) return view as T;
  };
  const state = await createPressState("en", load, theme);
  const router = createRouter({ base: "/", url, routes: [], fallback: PageView });
  router.beforeEach(async (to) => {
    const shown = to.record ? undefined : await loadPage(state, to.path);
    return () => {
      state.shown.value = shown;
    };
  });
  await router.start();

  const { Root } = state.theme;
  const app = createSSRApp({
    render: () => h(Root!, null, { default: () => h(RouterView) }),
  });
  app.provide(pressKey, state);
  app.provide(routerKey, router);
  return { app, router, state };
}
