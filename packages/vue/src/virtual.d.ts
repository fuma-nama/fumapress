declare module "virtual:press/collections" {
  import type { CollectionConfig } from "./collection";
  import type { SourceFile } from "./core/types";
  export const collections: Record<string, SourceFile<CollectionConfig>[]>;
}

declare module "virtual:press/config" {
  import type { Press } from "./core/press";
  const press: Press<any, any>;
  export default press;
}

declare module "virtual:press/theme" {
  import type { Theme } from "./client";
  const theme: Theme;
  export default theme;
}

declare module "virtual:press/routes" {
  import type { RouteRecord } from "./router";
  export const routes: RouteRecord[];
}

interface ImportMeta {
  /** set by Nitro: whether the server is the one a build prerenders with */
  readonly prerender?: boolean;
}
