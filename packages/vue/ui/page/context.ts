import type { AnchorHTMLAttributes } from "vue";

export interface EditOnGitHubOptions extends Omit<AnchorHTMLAttributes, "href"> {
  owner: string;
  repo: string;

  /**
   * SHA or ref (branch or tag) name.
   *
   * @defaultValue main
   */
  sha?: string;

  /**
   * File path in the repo
   */
  path: string;
}
