import {
  defineDocs,
  type Collection,
  type CollectionFiles,
  type DefaultMetaData,
  type DefaultPageData,
} from "../src/content";

type Files = Required<CollectionFiles>;

/**
 * The files of a collection in `content/`, as a compiled `defineDocs()` call receives them: the frontmatter of each
 * page by path, or the data of a `meta.json`.
 */
export function filesOf(
  files: Record<string, unknown>,
  lastModified?: Record<string, string>,
): Files {
  const pages: Files["pages"] = { frontmatter: {}, load: {}, assets: {}, lastModified };
  const meta: Files["meta"] = {};
  for (const [path, data] of Object.entries(files)) {
    const key = `./${path}`;
    if (path.endsWith(".json")) {
      meta[key] = data;
      continue;
    }
    pages.frontmatter[key] = data;
    pages.assets[key] = async () => ({ entry: `/assets/${path}.js` });
    pages.load[key] = async () => ({
      default: () => null,
      toc: [{ title: "Intro", url: "#intro", depth: 2 }],
      structuredData: {
        headings: [{ id: "intro", content: "Intro" }],
        contents: [{ heading: "intro", content: `Text of ${path}` }],
      },
      markdown: `## Intro\n\nText of ${path}\n`,
    });
  }
  return { dir: "content", pages, meta };
}

/** `defineDocs()` as the Vite plugin compiles a call: with the files of the collection */
export const compiledDefineDocs = defineDocs as unknown as (
  options: Parameters<typeof defineDocs>[0],
  files: CollectionFiles,
) => Promise<Collection<{ pageData: DefaultPageData; metaData: DefaultMetaData }>>;

/** a collection of these files, with the default schemas */
export function collectionOf(files: Record<string, unknown>) {
  return compiledDefineDocs({}, filesOf(files));
}
