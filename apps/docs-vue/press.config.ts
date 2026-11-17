import { createPress } from "@fumapress/vue/config";
import { content } from "@fumapress/vue/content";

export default createPress(content).config({
  site: {
    name: "Fumapress Vue",
    description: "A docs framework for Vue: your Markdown as a fast docs site, on Vite.",
    baseUrl: "https://vue.fumapress.dev",
    git: { user: "fuma-nama", repo: "fumapress", branch: "dev", dir: "apps/docs-vue" },
  },
});
