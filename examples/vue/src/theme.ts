import { BookOpen, Rocket } from "@lucide/vue";
import { defineTheme } from "@fumapress/vue/theme";
import defaultTheme from "@fumapress/vue/theme/default";
import type app from "../press.config";

// the default theme, with a component for the posts of the blog and for each view of the site
export default defineTheme<typeof app>({
  extends: defaultTheme,
  // each is loaded by the pages that render it
  views: {
    blog: () => import("./views/BlogPost.vue"),
    "blog.index": () => import("./views/BlogIndex.vue"),
    releases: () => import("./views/Releases.vue"),
  },
  // the icons of the page tree, by name
  icons: { BookOpen, Rocket },
});
