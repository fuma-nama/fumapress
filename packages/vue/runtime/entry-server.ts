import type { ComponentOptions } from "vue";
import { resolveTheme } from "@fumapress/vue/client";
import { createFetchHandler, renderApp } from "@fumapress/vue/server";
import press from "virtual:press/config";
import { routes } from "virtual:press/routes";
import theme from "virtual:press/theme";
import { createPressApp } from "./app.ts";
// the client entry's files, from Nitro
import clientAssets from "./entry-client.ts?assets=client";

// In development a stylesheet is a module the browser loads after the page: the ones the server imported are
// linked from the document, so a page doesn't show unstyled first.
const devAssets = import.meta.env.DEV ? [(await import("./app.ts?assets=ssr")).default] : [];

const resolved = resolveTheme(theme);

/** the key of the title of the not found page of the UI in the translations of a site */
const NOT_FOUND_TITLE = "Page Not Found(404 not found page)";

export default {
  fetch: createFetchHandler({
    press,
    base: import.meta.env.BASE_URL,
    assets: clientAssets,
    head: resolved.head,
    views: resolved.views,
    // a fact of the build: Nitro replaces it in the server it prerenders with, and in the one it deploys
    prerender: import.meta.prerender === true,
    customPages: routes.map((route) => route.path),
    async render({ ctx, url, pathname, lang, load, notFound }) {
      const { app, router, state } = await createPressApp(url, ctx.base, lang, load, notFound);
      const { record, component, path, query } = router.route.value;
      // a hook of the router sent the page to another path: the response redirects there
      if (path !== pathname) {
        const search = new URLSearchParams(query).toString();
        return { html: "", redirect: search ? `${path}?${search}` : path };
      }
      // the styles of a custom page are in its own files
      const pageAssets = record?.assets ? [(await record.assets()).default] : [];

      // a URL without a custom page is a content page or a view, or the not found page
      const missing = !record && !state.shown.value;
      return {
        html: await renderApp(app),
        status: missing ? 404 : 200,
        // A custom page names its title and description in its options. The not found page has the title of the not
        // found page of the UI, in the language of the page.
        pageData: record
          ? (component as ComponentOptions).page
          : missing
            ? { title: state.site.i18n?.translations?.[NOT_FOUND_TITLE] ?? "Page Not Found" }
            : undefined,
        assets: clientAssets.merge(...devAssets, ...pageAssets),
      };
    },
  }),
};
