import { createSSRApp, h } from "vue";
import { RouterView, createRouter, type RouterHistory } from "vue-router";
import { createPressState, languageOf, loadPage, pressKey, type Load } from "@fumapress/vue/client";
import { routes } from "virtual:press/routes";
import theme from "virtual:press/theme";

/** the route of content pages and the views of plugins, after the custom pages */
export const CONTENT_ROUTE = "press:content";

/**
 * The app of the site in a language, the same on the server and in the browser: `load` reads the data routes of the
 * server.
 */
export async function createPressApp(
  history: RouterHistory,
  base: string,
  lang: string,
  load: Load,
) {
  const state = await createPressState(base, lang, load, theme);
  const { Root } = theme;
  const app = createSSRApp({
    render: () => (Root ? h(Root, null, { default: () => h(RouterView) }) : h(RouterView)),
  });
  const router = createRouter({
    history,
    routes: [...routes, { path: "/:path(.*)*", name: CONTENT_ROUTE, component: theme.Layout }],
    scrollBehavior(to, _from, saved) {
      if (saved) return saved;
      if (to.hash) return { el: to.hash, top: 80 };
      return { top: 0 };
    },
  });

  router.beforeResolve(async (to) => {
    // the app has the data of one language, like its page tree: a page of another one is another document
    if (!import.meta.env.SSR && languageOf(state, to.path) !== state.lang) {
      window.location.assign(router.resolve(to).href);
      return false;
    }
    // the page is loaded before its route renders, so the server and the first paint have its content
    if (to.name === CONTENT_ROUTE) await loadPage(state, to.path);
  });

  // the server renders the tags of `<head>`: after a navigation, the browser updates the ones a reader sees
  if (!import.meta.env.SSR) {
    const { site } = state.site;
    router.afterEach((to) => {
      const page = to.name === CONTENT_ROUTE ? state.page.value : undefined;
      document.title = [page?.data.title, site.name].filter(Boolean).join(" | ");
      const description = page?.data.description ?? site.description;
      if (description) {
        document.querySelector('meta[name="description"]')?.setAttribute("content", description);
      }
    });
  }

  app.provide(pressKey, state);
  app.use(router);
  theme.enhanceApp?.({ app, router });
  return { app, router, state };
}
