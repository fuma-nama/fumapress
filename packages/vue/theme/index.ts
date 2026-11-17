import type { Theme, ThemeOptions } from "@fumapress/vue/client";
import type { Press } from "@fumapress/vue/config";

export { default as baseTheme } from "./base";
export { default as Root } from "./Root.vue";
export { components } from "./components";

/**
 * A theme, typed by the site of `press.config` with a type-only import: `defineTheme<typeof app>({ ... })`. The keys
 * of `views` are the page types of the site, each component receives the pages of its type, and every view has a
 * component in the theme's own `views`.
 */
export function defineTheme<A extends Press<any, any> = never>(theme: ThemeOptions<A>): Theme {
  // a theme, whose views the type checked against the site `A`
  return theme as Theme;
}
