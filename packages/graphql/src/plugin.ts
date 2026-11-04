import * as Fumadocs from "@fumadocs/graphql/press";
import type { GraphQLPageData } from "@fumadocs/graphql/server";
import type { AppShape, Plugin } from "@fumapress/core";

/** @deprecated use `GraphQLPluginOptions` of `@fumadocs/graphql/press` */
export interface GraphQLPluginOptions extends Fumadocs.GraphQLPluginOptions {}

/** @deprecated use `graphqlPlugin()`, the default export of `@fumadocs/graphql/press` */
export function graphqlPlugin<C extends AppShape = AppShape>(
  options: GraphQLPluginOptions,
): Plugin<C> {
  return { ...Fumadocs.default(options), name: "graphql:main" };
}

export function isGraphQLPageData(data: object): data is GraphQLPageData {
  return "getGraphQLPageProps" in data && typeof data.getGraphQLPageProps === "function";
}
