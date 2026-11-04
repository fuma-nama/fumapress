import * as Fumadocs from "@fumadocs/graphql/plugin";
import type { GraphQLPageData } from "@fumadocs/graphql/server";
import type { AppShape, Plugin } from "@fumapress/core";

/** @deprecated use `GraphQLPluginOptions` of `@fumadocs/graphql/plugin` */
export interface GraphQLPluginOptions extends Fumadocs.GraphQLPluginOptions {}

/** @deprecated use `graphqlPlugin()` of `@fumadocs/graphql/plugin` */
export function graphqlPlugin<C extends AppShape = AppShape>(
  options: GraphQLPluginOptions,
): Plugin<C> {
  return { ...Fumadocs.graphqlPlugin(options), name: "graphql:main" };
}

export function isGraphQLPageData(data: object): data is GraphQLPageData {
  return "getGraphQLPageProps" in data && typeof data.getGraphQLPageProps === "function";
}
