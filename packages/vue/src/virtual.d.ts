declare module "virtual:press/collections" {
  import type { SourceFile } from "./core/types";
  export const collections: Record<string, SourceFile[]>;
}

declare module "virtual:press/config" {
  import type { Press } from "./core/press";
  const press: Press;
  export default press;
}

declare module "virtual:press/theme" {
  import type { Theme } from "./client";
  const theme: Theme;
  export default theme;
}

declare module "virtual:press/routes" {
  import type { RouteRecordRaw } from "vue-router";
  export const routes: RouteRecordRaw[];
}
