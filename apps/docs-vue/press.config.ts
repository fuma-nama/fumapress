import { createPress } from "@fumapress/vue/config";
import { defineDocs } from "@fumapress/vue/content";

const docs = defineDocs({ dir: "content" });

export default createPress(docs.toFumadocsSource()).config({
  site: {
    name: "Fumapress Vue",
    description: "A docs framework for Vue: your Markdown as a fast docs site, on Vite.",
    baseUrl: "https://vue.fumapress.dev",
    git: { user: "fuma-nama", repo: "fumapress", branch: "dev", dir: "apps/docs-vue" },
  },
});
