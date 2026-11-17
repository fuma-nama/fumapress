import type { Source, SourceFile } from "./core/types";

/** the Markdown files of a directory, from the Vite plugin: a page has its compiled module in `data._module` */
export interface Collection {
  name: string;
  files: SourceFile[];
  /**
   * The files as a content source. `baseDir` puts them in a folder, so their URLs start with it:
   * `{ baseDir: "docs" }` gives `/docs/...`.
   */
  toSource: (options?: { baseDir?: string }) => Source;
}

export function createCollection(name: string, files: SourceFile[]): Collection {
  return {
    name,
    files,
    toSource({ baseDir } = {}) {
      if (!baseDir) return { files };
      const prefix = `${baseDir.replace(/^\/+|\/+$/g, "")}/`;
      return { files: files.map((file) => ({ ...file, path: prefix + file.path })) };
    },
  };
}
