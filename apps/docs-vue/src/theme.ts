import {
  Blocks,
  BookOpen,
  FileCode,
  Gauge,
  Languages,
  LayoutTemplate,
  Paintbrush,
  Plug,
  Rocket,
  Search,
  Server,
  Settings,
  Terminal,
  Zap,
} from "@lucide/vue";
import { defineTheme } from "@fumapress/vue/theme";
import defaultTheme from "@fumapress/vue/theme/default";
import type app from "../press.config";

// the default theme, with the icons of the sidebar by the `icon` of a page or a folder
export default defineTheme<typeof app>({
  extends: defaultTheme,
  icons: {
    Blocks,
    BookOpen,
    FileCode,
    Gauge,
    Languages,
    LayoutTemplate,
    Paintbrush,
    Plug,
    Rocket,
    Search,
    Server,
    Settings,
    Terminal,
    Zap,
  },
});
