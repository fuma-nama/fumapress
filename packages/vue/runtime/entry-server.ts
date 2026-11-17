import type { ComponentOptions } from "vue";
import { renderToString } from "vue/server-renderer";
import { createFetchHandler, encodePath, type ClientAssets } from "@fumapress/vue/server";
import press from "virtual:press/config";
import { routes } from "virtual:press/routes";
import theme from "virtual:press/theme";
import { createPressApp } from "./app.ts";
// the client entry's files, from Nitro
import clientAssets from "./entry-client.ts?assets=client";

type Assets = ClientAssets & { merge: (...assets: ClientAssets[]) => ClientAssets };

// In development a stylesheet is a module the browser loads after the page: the ones the server imported are
// linked from the document, so a page doesn't show unstyled first.
const devAssets: ClientAssets[] = import.meta.env.DEV
  ? [((await import("./app.ts?assets=ssr")) as { default: ClientAssets }).default]
  : [];

export default {
  fetch: createFetchHandler({
    press,
    base: import.meta.env.BASE_URL,
    assets: clientAssets as Assets,
    head: theme.head,
    // a fact of the build: Nitro replaces it in the server it prerenders with, and in the one it deploys
    prerender: import.meta.prerender === true,
    // custom pages without params are known ahead, so they are generated at build time like content pages
    staticPaths: routes.map((route) => route.path).filter((path) => !path.includes("[")),
    async render({ ctx, pathname, search, lang, load }) {
      const { app, router, state } = await createPressApp(
        ctx.base + encodePath(pathname).slice(1) + search,
        ctx.base,
        lang,
        load,
      );
      const { record, component } = router.route.value;
      // the styles of a custom page are in its own files
      const pageAssets = record?.assets
        ? [((await record.assets()) as { default: ClientAssets }).default]
        : [];

      return {
        html: await renderToString(app),
        // a URL without a custom page is a content page or a view, or nothing
        status: !record && !state.page.value ? 404 : 200,
        // a custom page names its title and description in its options
        data: record ? (component as ComponentOptions).page : undefined,
        assets: (clientAssets as Assets).merge(...devAssets, ...pageAssets),
      };
    },
  }),
};
