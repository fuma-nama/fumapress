import type { AdvancedIndex } from "fumadocs-core/search/server";
import type { Awaitable } from "@/lib/types";
import type { PressPlugin } from "@/app/plugin";
import { withoutFallbackPages, type AppContext, type AppShape } from "@/app/context";
import type { PressProviderProps } from "@/components/provider";

export interface OramaSearchOptions<C extends AppShape = AppShape> {
  buildIndex?: (this: AppContext<C>, page: C["page"]) => Awaitable<AdvancedIndex>;
}

export function oramaSearchPlugin<C extends AppShape = AppShape>({
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

    throw new Error("[Fumapress] Please specify the `buildIndex` option to oramaSearchPlugin()");
  },
}: OramaSearchOptions<NoInfer<C>> = {}): PressPlugin<C> {
  return {
    name: "core:orama-search",
    preinit({ finalized }) {
      for (const item of finalized) {
        if (item.name === "core:flexsearch" || item.name === "core:orama-search") {
          throw new Error(
            `[Fumapress] "core:orama-search" conflicts with "${item.name}": only one search plugin can be added.`,
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
          props.search.SearchDialog ??= (await import("@/components/orama-search-static")).default;
        }
        return props;
      });
    },
    async createPages({ createApiIsomorphic }) {
      const { createFromSource } = await import("fumadocs-core/search/server");
      const renderMode = this.mode === "default" ? "dynamic" : this.mode;
      const server = createFromSource(
        async () => withoutFallbackPages(await this.getLoader(), this.i18nConfig),
        { buildIndex: buildIndex.bind(this) },
      );

      createApiIsomorphic({
        render: renderMode,
        path: "/api/search",
        handler: renderMode === "static" ? server.staticGET : server.GET,
      });
    },
  };
}
