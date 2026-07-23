import type { AppContext, AppShape, PressPlugin } from "fumapress";
import type { PageData } from "fumadocs-core/source";
import defaultMdxComponents, { createRelativeLink } from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import path from "node:path";
import * as ObsidianComponents from "fumadocs-obsidian/ui";
import type { ObsidianPage, ObsidianRendererResult } from "fumadocs-obsidian";

interface WatchableObsidianSource {
  readonly dir: string;
  readonly include: string[];
  invalidateFile: (file: string) => void;
}

export interface ObsidianPluginOptions {
  /** Add or override the default Fumadocs and Obsidian MDX components. */
  components?: MDXComponents;
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

export function obsidianPlugin<C extends AppShape = AppShape>(
  source: WatchableObsidianSource,
  options: ObsidianPluginOptions = {},
): PressPlugin<C> {
  const sourceDir = path.resolve(source.dir);
  const rendered = new WeakMap<object, Promise<ObsidianRendererResult>>();

  if (options.watch !== false && import.meta.env?.DEV) registerViteWatcher(source);

  function matches(page: C["page"]): page is C["page"] & { data: ObsidianPage } {
    if (!page.absolutePath || !isObsidianPageData(page.data)) return false;

    const relative = path.relative(sourceDir, page.absolutePath);
    return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  }

  function renderPage(
    context: AppContext<C>,
    page: C["page"] & { data: ObsidianPage },
  ): Promise<ObsidianRendererResult> {
    let result = rendered.get(page.data);
    if (result) return result;

    result = Promise.all([page.data.load(), context.getLoader()]).then(([renderer, loader]) =>
      renderer.render({
        ...defaultMdxComponents,
        ...ObsidianComponents,
        a: createRelativeLink(loader, page),
        ...options.components,
      }),
    );
    rendered.set(page.data, result);
    return result;
  }

  return {
    name: "obsidian",
    init() {
      this.adapters.push({
        async "core:get-text"(page) {
          if (!matches(page)) return;
          const { structuredData } = await page.data.load();
          return structuredData.contents.map((item) => item.content).join("\n\n");
        },
        async "core:get-body"(page) {
          if (!matches(page)) return;
          return { node: (await renderPage(this, page)).body };
        },
        async "core:render-toc"(page) {
          if (!matches(page)) return;
          return (await renderPage(this, page)).toc;
        },
        async "core:get-structured-data"(page) {
          if (!matches(page)) return;
          return (await page.data.load()).structuredData;
        },
      });
    },
  };
}

function registerViteWatcher(source: WatchableObsidianSource): void {
  let dispose: (() => void) | undefined;
  let disposed = false;

  void import("fumadocs-obsidian/dev/vite").then(({ watchWithVite }) => {
    dispose = watchWithVite(source);
    if (disposed) dispose();
  });

  import.meta.hot?.dispose(() => {
    disposed = true;
    dispose?.();
  });
}
