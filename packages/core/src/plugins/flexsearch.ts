import type { Index } from "fumadocs-core/search/flexsearch";
import type { Awaitable } from "@/lib/types";
import { withoutFallbackPages, type AppContext, type AppShape } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";
import type { PressProviderProps } from "@/components/provider";

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
    preinit({ finalized }) {
      for (const item of finalized) {
        if (item.name === "core:flexsearch" || item.name === "core:orama-search") {
          throw new Error(
            `[Fumapress] "core:flexsearch" conflicts with "${item.name}": only one search plugin can be added.`,
          );
        }
      }
    },
    init() {
      const data = (this.data["core:provider"] ??= {});
      const transformers = (data.transformers ??= []);

      transformers.push(async (props: PressProviderProps) => {
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
      const server = flexsearchFromSource(
        async () => withoutFallbackPages(await this.getLoader(), this.i18nConfig),
        { buildIndex: buildIndex.bind(this) },
      );

      createApiIsomorphic({
        render,
        path: "/api/search",
        handler: render === "static" ? server.staticGET : server.GET,
      });
    },
  };
}
