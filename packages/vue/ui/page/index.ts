import type * as Docs from "../layouts/docs/page";
import type { EditOnGitHubOptions } from "./context";

// TODO: remove this compat layer on v17

export {
  DocsDescription,
  DocsTitle,
  EditOnGitHub,
  DocsBody,
  PageBreadcrumb,
  PageLastUpdate,
} from "../layouts/docs/page";
export { default as withArticle } from "./withArticle.vue";
export { default as DocsPage } from "./DocsPage.vue";

export interface DocsPageProps extends Docs.DocsPageProps {
  editOnGithub?: EditOnGitHubOptions;
  lastUpdate?: Date | string | number;
}
