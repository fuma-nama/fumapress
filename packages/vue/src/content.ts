import type { MetaData, PageData, StaticSource } from "fumadocs-core/source";
import {
  defaultMetaSchema,
  defaultPageSchema,
  type DefaultMetaData,
  type DefaultPageData,
  type StandardSchemaV1,
} from "./core/schema";
import type { PageModule, SourceConfig, SourceFile } from "./core/types";
import { moduleKey, type ModuleRef } from "./plugins/markdown";

export type { DefaultMetaData, DefaultPageData, StandardSchemaV1 } from "./core/schema";
export type { Source, SourceConfig, SourceFile } from "./core/types";

export interface DocOptions<Schema, LastModified extends boolean> {
  /**
   * Patterns of the pages, from `dir`: one starting with `!` leaves files out. A literal, read when the site is built.
   *
   * @defaultValue ["**\/*.{md,mdx}"]
   */
  files?: string[];
  /** validates the frontmatter of each page: a Standard Schema, like a Zod object @defaultValue the fields of `pageSchema` */
  schema?: Schema;
  /** `page.data.lastModified` of each page: the date of the last commit of its file. A literal. */
  lastModified?: LastModified;
}

export interface MetaOptions<Schema> {
  /**
   * Patterns of the `meta.json` files, from `dir`: one starting with `!` leaves files out. A literal.
   *
   * @defaultValue ["**\/meta{,.*}.json"]
   */
  files?: string[];
  /** validates each `meta.json`: a Standard Schema @defaultValue the fields of `metaSchema` */
  schema?: Schema;
}

export interface DocsOptions<PageSchema, MetaSchema, LastModified extends boolean> {
  /** the folder of the pages and `meta.json` files, from the project root. A literal. @defaultValue "content" */
  dir?: string;
  docs?: DocOptions<PageSchema, LastModified>;
  meta?: MetaOptions<MetaSchema>;
}

export interface DocCollectionOptions<Schema, LastModified extends boolean> extends DocOptions<
  Schema,
  LastModified
> {
  /** a collection of pages, the one type: `meta.json` files are in the collections of `defineDocs()` */
  type: "doc";
  /** the folder of the pages, from the project root. A literal. */
  dir: string;
}

export interface ToFumadocsSourceOptions {
  /** puts the files in a folder, so their URLs start with it: `"docs"` gives `/docs/...` */
  baseDir?: string;
}

/** the files of a folder, validated by the schemas of the collection */
export interface Collection<Config extends SourceConfig> {
  /** the files as a content source of `createPress()`: a static one, the `Source` of Fumadocs */
  toFumadocsSource(options?: ToFumadocsSourceOptions): StaticSource<Config>;
}

/** what the Vite plugin passes to a call of a macro it compiled: the files of the collection, by path from `dir` */
export interface CollectionFiles {
  /** the folder of the collection, from the project root */
  dir: string;
  pages: {
    frontmatter: Record<string, unknown>;
    /** the compiled module of each page on the server */
    load: Record<string, () => Promise<PageModule>>;
    /** the file of each page in the browser build */
    assets: Record<string, () => Promise<{ entry: string }>>;
    /** with `lastModified: true`, the date of the last commit of each page */
    lastModified?: Record<string, string>;
  };
  meta?: Record<string, unknown>;
}

type PageSchema = StandardSchemaV1<unknown, PageData>;
type MetaSchema = StandardSchemaV1<unknown, MetaData>;

/** the data of a page: the output of the schema, with the date of `lastModified: true` */
type PageOutput<
  Schema extends PageSchema,
  LastModified extends boolean,
> = StandardSchemaV1.InferOutput<Schema> &
  (LastModified extends true ? { lastModified?: Date } : unknown);

function notCompiled(name: string): Error {
  return new Error(
    `[Fumapress] \`${name}()\` was not compiled. It is a macro: the Vite plugin of Fumapress compiles it in \`press.config\` (.ts, .mts, .js or .mjs) at the root of the project, as the value of a top-level \`const\`, like \`const docs = ${name}({ ... })\`. Call it there.`,
  );
}

/** the files of a collection, validated; one error names every file that doesn't match its schema */
async function createCollection(
  { dir, pages, meta = {} }: CollectionFiles,
  schemas: { page: StandardSchemaV1; meta: StandardSchemaV1 },
): Promise<Collection<SourceConfig>> {
  const failures: string[] = [];
  // a key of `import.meta.glob` is `./` and the path from `dir`
  const pathOf = (key: string) => key.slice(2);
  const fromRoot = (key: string) => (dir ? `${dir}/${pathOf(key)}` : pathOf(key));

  async function validate(schema: StandardSchemaV1, data: unknown, key: string) {
    const result = await schema["~standard"].validate(data);
    if (!result.issues) return result.value as Record<string, unknown>;
    const issues = result.issues.map((issue) => {
      const path = issue.path?.map((key) => String(typeof key === "object" ? key.key : key));
      return `  - ${path?.length ? `${path.join(".")}: ` : ""}${issue.message}`;
    });
    failures.push(
      `${fromRoot(key)} doesn't match the schema of its collection:\n${issues.join("\n")}`,
    );
  }

  const files = await Promise.all([
    ...Object.entries(pages.frontmatter).map(async ([key, frontmatter]): Promise<SourceFile> => {
      const ref: ModuleRef = {
        file: fromRoot(key),
        load: pages.load[key]!,
        assets: pages.assets[key]!,
      };
      const date = pages.lastModified && {
        lastModified: pages.lastModified[key] && new Date(pages.lastModified[key]),
      };
      const data = {
        ...(await validate(schemas.page, frontmatter, key)),
        ...date,
        [moduleKey]: ref,
      };
      return { type: "page", path: pathOf(key), data: data as PageData };
    }),
    ...Object.entries(meta).map(async ([key, data]): Promise<SourceFile> => {
      return {
        type: "meta",
        path: pathOf(key),
        data: (await validate(schemas.meta, data, key)) ?? {},
      };
    }),
  ]);
  if (failures.length > 0) throw new Error(`[Fumapress] ${failures.join("\n")}`);

  return { toFumadocsSource: ({ baseDir } = {}) => ({ baseDir, files }) };
}

/**
 * The pages and `meta.json` files of a folder. A macro: call it in `press.config` as the value of a top-level
 * `const`, with literals for `dir`, `files` and `lastModified`.
 */
export function defineDocs<
  Page extends PageSchema = StandardSchemaV1<unknown, DefaultPageData>,
  Meta extends MetaSchema = StandardSchemaV1<unknown, DefaultMetaData>,
  const LastModified extends boolean = false,
>(
  options?: DocsOptions<Page, Meta, LastModified>,
): Collection<{
  pageData: PageOutput<Page, LastModified>;
  metaData: StandardSchemaV1.InferOutput<Meta>;
}>;

// The Vite plugin compiles a call to `await defineDocs(options, files)`, which creates the collection.
export function defineDocs(
  options: DocsOptions<StandardSchemaV1, StandardSchemaV1, boolean> = {},
  files?: CollectionFiles,
): unknown {
  if (!files) throw notCompiled("defineDocs");
  return createCollection(files, {
    page: options.docs?.schema ?? defaultPageSchema,
    meta: options.meta?.schema ?? defaultMetaSchema,
  });
}

/**
 * The pages of a folder, without `meta.json` files. A macro: call it in `press.config` as the value of a top-level
 * `const`, with literals for `type`, `dir`, `files` and `lastModified`.
 */
export function defineCollections<
  Page extends PageSchema = StandardSchemaV1<unknown, DefaultPageData>,
  const LastModified extends boolean = false,
>(
  options: DocCollectionOptions<Page, LastModified>,
): Collection<{ pageData: PageOutput<Page, LastModified>; metaData: MetaData }>;

// The Vite plugin compiles a call to `await defineCollections(options, files)`, which creates the collection.
export function defineCollections(
  options: DocCollectionOptions<StandardSchemaV1, boolean>,
  files?: CollectionFiles,
): unknown {
  if (!files) throw notCompiled("defineCollections");
  return createCollection(files, {
    page: options.schema ?? defaultPageSchema,
    meta: defaultMetaSchema,
  });
}
