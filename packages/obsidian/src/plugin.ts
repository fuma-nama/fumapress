import type { ObsidianPage, ObsidianSource } from "fumadocs-obsidian";
import * as Fumadocs from "fumadocs-obsidian/plugin";
import type { PageData } from "fumadocs-core/source";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { AppShape, Plugin } from "@fumapress/core";

/** @deprecated use `ObsidianPluginOptions` of `fumadocs-obsidian/plugin` */
export interface ObsidianPluginOptions extends Omit<Fumadocs.ObsidianPluginOptions, "vault"> {
  /**
   * Watch the vault through Vite during development. Add `obsidianVitePlugin()`
   * to the Waku Vite config to receive file changes.
   *
   * @default true
   */
  watch?: boolean;
}

/** Returns whether page data has the `fumadocs-obsidian` runtime shape. */
export function isObsidianPageData(data: PageData): data is ObsidianPage {
  const candidate = data as Partial<ObsidianPage>;

  return (
    typeof candidate.title === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.frontmatter === "object" &&
    candidate.frontmatter !== null &&
    typeof candidate.load === "function"
  );
}

/**
 * @deprecated use `obsidianPlugin()` of `fumadocs-obsidian/plugin` with the MDX components of Fumadocs UI, and `watchWithVite()` of `fumadocs-obsidian/dev/vite`
 */
export function obsidianPlugin<C extends AppShape = AppShape>(
  vault: ObsidianSource,
  { watch = true, components }: ObsidianPluginOptions = {},
): Plugin<C> {
  return {
    ...Fumadocs.obsidianPlugin({
      vault,
      components: { ...defaultMdxComponents, ...components },
    }),
    async init() {
      if (!watch || !import.meta.env?.DEV) return;
      const { watchWithVite } = await import("fumadocs-obsidian/dev/vite");
      if (!this.signal.aborted) this.signal.addEventListener("abort", watchWithVite(vault));
    },
  };
}
