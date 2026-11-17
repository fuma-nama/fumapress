import { renderToString } from "vue/server-renderer";
import { createMemoryHistory } from "vue-router";
import { createFetchHandler, type ClientAssets } from "@fumapress/vue/server";
import press from "virtual:press/config";
import { routes } from "virtual:press/routes";
import theme from "virtual:press/theme";
import { CONTENT_ROUTE, createPressApp } from "./app.ts";
// the client entry's files, from Nitro
import clientAssets from "./entry-client.ts?assets=client";

type Assets = ClientAssets & { merge: (...assets: ClientAssets[]) => ClientAssets };

export default {
  fetch: createFetchHandler({
    press,
    base: import.meta.env.BASE_URL,
    assets: clientAssets as Assets,
    head: theme.head,
    // custom pages without params are known ahead, so they are generated at build time like content pages
    staticPaths: routes.map((route) => route.path).filter((path) => !path.includes(":")),
    async render({ ctx, pathname, search, lang, load }) {
      const { app, router, state } = await createPressApp(
        createMemoryHistory(ctx.base),
        ctx.base,
        lang,
        load,
      );
      await router.push(pathname + search);
      await router.isReady();

      const route = router.currentRoute.value;
      // the styles of a custom page are in its own files
      const routeAssets = await Promise.all(
        route.matched.flatMap((record) => {
          const assets = record.meta.assets as
            | (() => Promise<{ default: ClientAssets }>)
            | undefined;
          return assets ? [assets().then((mod) => mod.default)] : [];
        }),
      );

      return {
        html: await renderToString(app),
        status: route.name === CONTENT_ROUTE && !state.page.value ? 404 : 200,
        assets: (clientAssets as Assets).merge(...routeAssets),
      };
    },
  }),
};
