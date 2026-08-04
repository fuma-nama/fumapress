import type { Adapter, AppShape, PressPlugin } from "fumapress";
import type { DocsLayoutContextData } from "fumapress/layouts/docs";
import type { FC } from "react";
import type { GraphQLPageData, GraphQLServer } from "@fumadocs/graphql/server";
import type { GraphQLPageProps } from "@fumadocs/graphql/ui";
import { graphqlTranslations } from "@fumadocs/graphql/i18n";

export interface GraphQLPluginOptions {
  server: GraphQLServer;

  /** do not add the loader plugin for GraphQL integration */
  disableLoaderPlugin?: boolean;

  /** must be a client component */
  ClientAPIPage?: FC<GraphQLPageProps>;
}

/**
 * this will register the GraphQL adapter & required layout configs.
 */
export function graphqlPlugin<C extends AppShape>(options: GraphQLPluginOptions): PressPlugin<C> {
  const { server, disableLoaderPlugin = false } = options;

  function initTransformers(data: DocsLayoutContextData<C>) {
    const transformers = (data.transformers ??= []);
    transformers.push(({ data, page }) => {
      if (isGraphQLPageData(page.data)) {
        data.pageProps.full ??= true;
      }
      return data;
    });
  }

  return {
    name: "graphql:main",
    init() {
      this.adapters.push(adapter(options));
      initTransformers((this.data["core:docs-layout"] ??= {}));
      initTransformers((this.data["core:notebook-layout"] ??= {}) as DocsLayoutContextData<C>);
      initTransformers((this.data["core:glass-layout"] ??= {}) as DocsLayoutContextData<C>);

      if (this.translationsConfig) {
        this.translationsConfig.extend(graphqlTranslations());
      }
    },
    configureLoader(options) {
      if (!disableLoaderPlugin) {
        options.plugins ??= [];
        options.plugins.push(server.loaderPlugin());
      }

      return options;
    },
  };
}

function adapter<C extends AppShape>(options: GraphQLPluginOptions): Adapter<C> {
  return {
    async "core:get-body"(page) {
      if (isGraphQLPageData(page.data)) {
        const ClientAPIPage = options.ClientAPIPage ?? (await import("./components/page")).default;
        const props = page.data.getGraphQLPageProps();

        return { node: <ClientAPIPage {...props} /> };
      }
    },
    "core:render-toc"(page) {
      if (isGraphQLPageData(page.data)) {
        return page.data.toc;
      }
    },
    "core:get-structured-data"(page) {
      if (isGraphQLPageData(page.data)) return page.data.structuredData;
    },
  };
}

export function isGraphQLPageData(data: object): data is GraphQLPageData {
  return "getGraphQLPageProps" in data && typeof data.getGraphQLPageProps === "function";
}
