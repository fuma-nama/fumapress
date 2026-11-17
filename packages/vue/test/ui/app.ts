// The app of a site with one of the layouts of the UI, built like `createPressApp()` of `runtime/app.ts`, which can't
// be imported as it is: it reads the theme and the routes from the virtual modules of the Vite plugin. The same module
// runs on the server (`render-layouts.ts`) and in the browser (`ui-layouts.test.ts`), so both render the same data.
import { createSSRApp, defineComponent, h, type Component } from "vue";
import {
  RouterView,
  createPressState,
  createRouter,
  loadPage,
  pressKey,
  routerKey,
  useLayoutProps,
  usePage,
  usePageTree,
  type Load,
  type Theme,
} from "@fumapress/vue/client";
import { pageDataPath, siteDataPath } from "../../src/core/routes";
import type { PageContent, SiteData } from "../../src/core/types";
import Root from "../../theme/Root.vue";
import { Languages } from "../../ui/icons";
import * as docs from "../../ui/layouts/docs";
import * as docsPage from "../../ui/layouts/docs/page";
import * as flux from "../../ui/layouts/flux";
import * as fluxPage from "../../ui/layouts/flux/page";
import * as glass from "../../ui/layouts/glass";
import * as glassPage from "../../ui/layouts/glass/page";
import { HomeLayout } from "../../ui/layouts/home";
import * as notebook from "../../ui/layouts/notebook";
import * as notebookPage from "../../ui/layouts/notebook/page";
import * as spacious from "../../ui/layouts/spacious";
import * as spaciousPage from "../../ui/layouts/spacious/page";

/** a nested page, so the sidebar opens folders and the breadcrumb has items */
export const PAGE_URL = "/docs/configure/theme";

export const site: SiteData = {
  site: { name: "Press", description: "Docs of Press" },
  layout: {
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
  data: {
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

/** the data routes the app reads: the server answers them, the browser receives them with the document */
const load: Load = async <T>(path: string) => {
  if (path === siteDataPath("en")) return site as T;
  if (path === pageDataPath(PAGE_URL)) return page as T;
};

interface PageModule {
  DocsPage: Component;
  DocsTitle: Component;
  DocsDescription: Component;
  DocsBody: Component;
  EditOnGitHub: Component;
  PageLastUpdate: Component;
}

/** a docs layout with a page in it, like `theme/Layout.vue` */
function docsLayout(DocsLayout: Component, parts: PageModule): Component {
  return defineComponent({
    setup() {
      const page = usePage();
      const tree = usePageTree();
      const { nav, links, githubUrl } = useLayoutProps();

      return () => {
        const { data, toc, Content } = page.value!;
        return h(DocsLayout, { tree, nav, links, githubUrl }, () =>
          h(parts.DocsPage, { toc }, () => [
            h(parts.DocsTitle, null, () => data.title),
            h(parts.DocsDescription, null, () => data.description),
            h(parts.DocsBody, null, () => h(Content)),
            h(parts.EditOnGitHub, { href: data.githubUrl }),
            h(parts.PageLastUpdate, { date: new Date(data.lastModified!) }),
          ]),
        );
      };
    },
  });
}

const Home = defineComponent({
  setup() {
    const { nav, links, githubUrl } = useLayoutProps();
    return () => h(HomeLayout, { nav, links, githubUrl }, () => h("h1", "Press"));
  },
});

export const layouts = {
  docs: docsLayout(docs.DocsLayout, docsPage),
  notebook: docsLayout(notebook.DocsLayout, notebookPage),
  glass: docsLayout(glass.DocsLayout, glassPage),
  spacious: docsLayout(spacious.DocsLayout, spaciousPage),
  flux: docsLayout(flux.DocsLayout, fluxPage),
  home: Home,
} satisfies Record<string, Component>;

export type LayoutName = keyof typeof layouts;

export async function createTestApp(layout: LayoutName) {
  const theme: Theme = { Root, Layout: layouts[layout], icons: { Languages } };
  const state = await createPressState("en", load, theme);
  const router = await createRouter({
    base: "/",
    url: PAGE_URL,
    routes: [],
    fallback: theme.Layout,
    async beforeEach(to) {
      const page = to.record ? undefined : await loadPage(state, to.path);
      return () => {
        state.page.value = page;
      };
    },
  });

  const app = createSSRApp({
    render: () => h(Root, null, { default: () => h(RouterView) }),
  });
  app.provide(pressKey, state);
  app.provide(routerKey, router);
  return { app, router, state };
}
