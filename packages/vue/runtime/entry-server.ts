import type { ComponentOptions } from "vue";
import { renderToString } from "vue/server-renderer";
import { resolveTheme } from "@fumapress/vue/client";
import { createFetchHandler } from "@fumapress/vue/server";
import press from "virtual:press/config";
import { routes } from "virtual:press/routes";
import theme from "virtual:press/theme";
import { createPressApp } from "./app.ts";
// the client entry's files, from Nitro
import clientAssets from "./entry-client.ts?assets=client";

// In development a stylesheet is a module the browser loads after the page: the ones the server imported are
// linked from the document, so a page doesn't show unstyled first.
const devAssets = import.meta.env.DEV ? [(await import("./app.ts?assets=ssr")).default] : [];

export default {
  fetch: createFetchHandler({
    press,
    base: import.meta.env.BASE_URL,
    assets: clientAssets,
    head: resolveTheme(theme).head,
    // a fact of the build: Nitro replaces it in the server it prerenders with, and in the one it deploys
    prerender: import.meta.prerender === true,
    customPages: routes.map((route) => route.path),
    async render({ ctx, url, pathname, lang, load }) {
      const { app, router, state } = await createPressApp(url, ctx.base, lang, load);
      const { record, component, path, query } = router.route.value;
      // a hook of the router sent the page to another path: the response redirects there
      if (path !== pathname) {
        const search = new URLSearchParams(query).toString();
        return { html: "", redirect: search ? `${path}?${search}` : path };
      }
      // the styles of a custom page are in its own files
      const pageAssets = record?.assets ? [(await record.assets()).default] : [];

      return {
        html: await renderToString(app),
        // a URL without a custom page is a content page or a view, or nothing
        status: !record && !state.shown.value ? 404 : 200,
        // a custom page names its title and description in its options
        pageData: record ? (component as ComponentOptions).page : undefined,
        assets: clientAssets.merge(...devAssets, ...pageAssets),
      };
    },
  }),
};
