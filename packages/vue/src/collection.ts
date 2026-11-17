import type { I18nConfig } from "fumadocs-core/i18n";
import type { MetaData, PageData } from "fumadocs-core/source";
import type { Source, SourceFile } from "./core/types";

/** the files of a collection: the frontmatter of its pages and its `meta.json` files, with any field */
export interface CollectionConfig {
  pageData: PageData & Record<string, unknown>;
  metaData: MetaData & Record<string, unknown>;
}

export interface ToSourceOptions {
  /** puts the files in a folder, so their URLs start with it: `"docs"` gives `/docs/...` */
  baseDir?: string;
  /**
   * The languages of the site, when its files name their language by folder (`parser: "dir"`): the folder of a
   * language stays the first one, before `baseDir`.
   */
  i18n?: Pick<I18nConfig, "languages" | "parser">;
}

/** the Markdown files of a directory, from the Vite plugin: a page has its compiled module in `data._module` */
export interface Collection {
  name: string;
  files: SourceFile<CollectionConfig>[];
  /** the files as a content source */
  toSource: (options?: ToSourceOptions) => Source<CollectionConfig>;
}

export function createCollection(name: string, files: SourceFile<CollectionConfig>[]): Collection {
  return {
    name,
    files,
    toSource({ baseDir, i18n } = {}) {
      const dir = baseDir?.replace(/^\/+|\/+$/g, "");
      if (!dir) return { files };

      const byFolder: readonly string[] = i18n?.parser === "dir" ? i18n.languages : [];
      const move = (path: string) => {
        const [first = "", ...rest] = path.split("/");
        return byFolder.includes(first) && rest.length > 0
          ? `${first}/${dir}/${rest.join("/")}`
          : `${dir}/${path}`;
      };
      return { files: files.map((file) => ({ ...file, path: move(file.path) })) };
    },
  };
}
