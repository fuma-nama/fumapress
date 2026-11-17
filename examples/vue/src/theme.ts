import { defineAsyncComponent } from "vue";
import type { Theme } from "@fumapress/vue/client";
import { BookOpen, Rocket } from "@lucide/vue";

// over the default theme: the components of the pages of plugins, and the icons of the page tree by name
export default {
  // loaded by the pages that show it
  views: { releases: defineAsyncComponent(() => import("./views/Releases.vue")) },
  icons: { BookOpen, Rocket },
} satisfies Partial<Theme>;
