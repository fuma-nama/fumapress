import * as Fumadocs from "@fumadocs/graphql/plugin";
import type { GraphQLPageData } from "@fumadocs/graphql/server";

/** @deprecated use `GraphQLPluginOptions` of `@fumadocs/graphql/plugin` */
export type GraphQLPluginOptions = Fumadocs.GraphQLPluginOptions;

/** @deprecated use `graphqlPlugin()` of `@fumadocs/graphql/plugin` */
export const graphqlPlugin = Fumadocs.graphqlPlugin;

export function isGraphQLPageData(data: object): data is GraphQLPageData {
  return "getGraphQLPageProps" in data && typeof data.getGraphQLPageProps === "function";
}
