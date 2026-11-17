import type { Theme } from "@fumapress/vue/client";
import {
  Blocks,
  BookOpen,
  Component,
  Gauge,
  Languages,
  Paintbrush,
  Plug,
  Rocket,
  Search,
  Server,
  Settings,
  Terminal,
} from "lucide-vue-next";

// the icons of the sidebar, by the `icon` of a page or a folder
export default {
  icons: {
    Blocks,
    BookOpen,
    Component,
    Gauge,
    Languages,
    Paintbrush,
    Plug,
    Rocket,
    Search,
    Server,
    Settings,
    Terminal,
  },
} satisfies Partial<Theme>;
