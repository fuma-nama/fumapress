import type { Theme } from "@fumapress/vue/client";
import baseTheme from "./base";
import DocsLayout from "./layouts/Docs.vue";

/**
 * The default theme: the base theme, with the docs layout for content pages. A theme with another layout for them
 * extends the base theme, as this one does, so its site has no code of the docs layout.
 */
export default { extends: baseTheme, views: { default: DocsLayout } } satisfies Theme;
