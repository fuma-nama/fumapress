import type { Index } from "fumadocs-core/search/flexsearch";
import type { Awaitable } from "@/lib/types";
import type { AppContext, AppShape } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";

export interface FlexsearchOptions<C extends AppShape = AppShape> {
  buildIndex?: (this: AppContext<C>, page: C["page"]) => Awaitable<Index>;
}

export function flexsearchPlugin<C extends AppShape = AppShape>({
  buildIndex = async function buildIndexDefault(page) {
    for (const adapter of this.adapters) {
      const structuredData = await adapter["core:get-structured-data"]?.call(this, page);

      if (structuredData !== undefined) {
        return {
          id: page.url,
          title: page.data.title ?? page.path,
          description: page.data.description,
          url: page.url,
          structuredData,
        };
      }
    }

    throw new Error("[Fumapress] Please specify the `buildIndex` option to flexsearchPlugin()");
  },
}: FlexsearchOptions<NoInfer<C>> = {}): PressPlugin<C> {
  return {
    name: "core:flexsearch",
    init() {
      const hooks = (this.data["core:provider"] ??= []);

      hooks.push(async (props) => {
        props.search ??= { enabled: true };

        if (this.mode === "static") {
          props.search.SearchDialog ??= (await import("@/components/flexsearch-static")).default;
        }

        return props;
      });
    },
    async createPages({ createApiIsomorphic }) {
      const { flexsearchFromSource } = await import("fumadocs-core/search/flexsearch");
      const render = this.mode === "default" ? "dynamic" : this.mode;
      const server = flexsearchFromSource(this.getLoader, {
        buildIndex: buildIndex.bind(this),
      });

      createApiIsomorphic({
        render,
        path: "/api/search",
        handler: render === "static" ? server.staticGET : server.GET,
      });
    },
  };
}
