import type { ObsidianPage } from "fumadocs-obsidian";
import * as Fumadocs from "fumadocs-obsidian/plugin";
import * as ObsidianComponents from "fumadocs-obsidian/ui";
import type { Plugin } from "fumadocs-core/framework/plugin";
import type { PageData } from "fumadocs-core/source";
import defaultMdxComponents from "fumadocs-ui/mdx";

/** the vault of `obsidian()` */
type Vault = Parameters<typeof Fumadocs.obsidianPlugin>[0];

/** @deprecated use `ObsidianPluginOptions` of `fumadocs-obsidian/plugin` */
export interface ObsidianPluginOptions extends Fumadocs.ObsidianPluginOptions {
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
export function obsidianPlugin(
  vault: Vault,
  { watch = true, components }: ObsidianPluginOptions = {},
): Plugin {
  if (watch && import.meta.env?.DEV) registerViteWatcher(vault);

  return Fumadocs.obsidianPlugin(vault, {
    components: { ...defaultMdxComponents, ...ObsidianComponents, ...components },
  });
}

function registerViteWatcher(vault: Vault): void {
  let dispose: (() => void) | undefined;
  let disposed = false;

  void import("fumadocs-obsidian/dev/vite").then(({ watchWithVite }) => {
    dispose = watchWithVite(vault);
    if (disposed) dispose();
  });

  import.meta.hot?.dispose(() => {
    disposed = true;
    dispose?.();
  });
}
