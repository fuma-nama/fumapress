import { frameworks } from "../../../src/ui/framework";

export const staticParams = [{ framework: "waku" }, { framework: "astro" }];

export default ({ framework }: { framework: keyof typeof frameworks }) => ({
  ...frameworks[framework],
  root: true,
  pages: [
    "index",
    "manual-installation",
    "---Guides---",
    "content",
    "content-sources",
    "layouts",
    "custom-pages",
    "search",
    "internationalization",
    "deployment",
    "authentication",
    "---Extend---",
    "plugins",
    "plugins/authoring",
    "---Reference---",
    "configuration",
    "migrate",
  ],
});
