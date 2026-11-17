import { createSSRApp, h, type ComponentOptions } from "vue";
import {
  RouterView,
  createPressState,
  createRouter,
  languageOf,
  loadPage,
  pressKey,
  routerKey,
  type Load,
} from "@fumapress/vue/client";
import { routes } from "virtual:press/routes";
import theme from "virtual:press/theme";

/** says a text to screen readers, through a live region that is not shown */
function announce(text: string) {
  let region = document.getElementById("press-announcer");
  if (!region) {
    region = document.createElement("div");
    region.id = "press-announcer";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
    document.body.append(region);
  }
  region.textContent = text;
}

/**
 * The app of the site in a language, the same on the server and in the browser: `url` is where it starts, with the
 * base path, and `load` reads the data routes of the server.
 */
export async function createPressApp(url: string, base: string, lang: string, load: Load) {
  const state = await createPressState(base, lang, load, theme);
  const { site } = state.site;
  /** the path of the page last announced: another anchor of the same page is not one */
  let announced: string | undefined;

  const router = await createRouter({
    base,
    url,
    routes,
    // content pages, the views of plugins, and the not found page
    fallback: theme.Layout,
    hasPage: async (path) => (await loadPage(state, path)) !== undefined,
    async beforeEach(to, { first }) {
      // The app has the data of one language, like its page tree: a page of another one is another document. The
      // document the app starts in is the server's answer for the URL, whatever its language: asking again would loop.
      if (!first && languageOf(state, to.path) !== state.lang) {
        window.location.assign(to.href);
        return false;
      }
      // the page is loaded before it renders, so the server and the first paint have its content
      const page = to.record ? undefined : await loadPage(state, to.path);
      // applied when this navigation wins: a slower one never replaces the page of a later one
      return () => {
        state.page.value = page;
      };
    },
    // the server renders the tags of `<head>`: after a navigation, the browser updates the ones a reader sees
    afterEach(to) {
      // a content page comes with the head the server made; a custom page has its data in its options
      const own = to.record ? (to.component as ComponentOptions).page : undefined;
      const { head } = state.page.value ?? {};
      document.title = head?.title ?? [own?.title, site.name].filter(Boolean).join(" | ");
      const description = head?.description ?? own?.description ?? site.description;
      if (description) {
        document.querySelector('meta[name="description"]')?.setAttribute("content", description);
      }
      // a navigation loads no document, so a screen reader is told which page it is now
      if (to.path !== announced) announce(document.title);
      announced = to.path;
    },
  });

  announced = router.route.value.path;

  const { Root } = theme;
  const app = createSSRApp({
    render: () => (Root ? h(Root, null, { default: () => h(RouterView) }) : h(RouterView)),
  });
  app.provide(pressKey, state);
  app.provide(routerKey, router);
  theme.enhanceApp?.({ app, router });
  return { app, router, state };
}
