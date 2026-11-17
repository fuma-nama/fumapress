import { expect, test } from "vitest";
import { z } from "zod";
import {
  defineCollections,
  defineDocs,
  type CollectionFiles,
  type StandardSchemaV1,
} from "../src/content";
import { pageSchema } from "../src/schema";
import { compiledDefineDocs, filesOf } from "./collection";

// A collection validates its files when it is created on the server: the frontmatter of each page and each
// `meta.json`, with the schemas of its options.

/** the files of a collection, with the data of each by name: without the compiled module of a page */
const dataOf = async (collection: Promise<{ toFumadocsSource: () => { files: unknown } }>) =>
  ((await collection).toFumadocsSource().files as { path: string; data: object }[]).map(
    ({ path, data }) => ({ path, data: Object.fromEntries(Object.entries(data)) }),
  );

test("without a schema, the fields of `pageSchema` and `metaSchema` of Fumadocs", async () => {
  const files = filesOf({
    "index.mdx": { title: "Home", description: "The start", full: true, draft: true },
    "meta.json": { title: "Docs", pages: ["index"], root: "docs", color: "red" },
  });
  // the fields they don't list are left out, as Zod does
  expect(await dataOf(compiledDefineDocs({}, files))).toEqual([
    { path: "index.mdx", data: { title: "Home", description: "The start", full: true } },
    { path: "meta.json", data: { title: "Docs", pages: ["index"], root: "docs" } },
  ]);
});

test("a failure names each file and each of its issues", async () => {
  const files = filesOf({
    "index.mdx": { title: "Home" },
    "guide/install.mdx": { description: 1 },
    "guide/meta.json": { pages: "install", defaultOpen: "yes" },
  });
  await expect(compiledDefineDocs({}, files)).rejects.toThrow(
    [
      "[Fumapress] content/guide/install.mdx doesn't match the schema of its collection:",
      "  - title: expected a string, received undefined",
      "  - description: expected a string, received number",
      "content/guide/meta.json doesn't match the schema of its collection:",
      "  - pages: expected a list of strings, received string",
      "  - defaultOpen: expected a boolean, received string",
    ].join("\n"),
  );
});

test("any Standard Schema validates, like Zod or one of its own", async () => {
  const schema = pageSchema.extend({ date: z.string(), tags: z.array(z.string()).default([]) });
  const files = filesOf({ "hello.mdx": { title: "Hello", date: "2026-01-02" } });
  expect(await dataOf(compiledDefineDocs({ docs: { schema } }, files))).toEqual([
    { path: "hello.mdx", data: { title: "Hello", date: "2026-01-02", tags: [] } },
  ]);
  await expect(
    compiledDefineDocs({ docs: { schema } }, filesOf({ "hello.mdx": { title: "Hello" } })),
  ).rejects.toThrow(
    "content/hello.mdx doesn't match the schema of its collection:\n  - date: Invalid input",
  );

  // asynchronous, with its own issues
  const own: StandardSchemaV1<unknown, { title: string }> = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: async (value) =>
        (value as { title?: string }).title === "Hello"
          ? { value: { title: "Hello" } }
          : { issues: [{ message: "only Hello", path: [{ key: "title" }] }] },
    },
  };
  const compiled = defineCollections as unknown as (
    options: object,
    files: CollectionFiles,
  ) => ReturnType<typeof compiledDefineDocs>;
  const { pages } = filesOf({ "a.md": { title: "Hello" }, "b.md": { title: "Bye" } });
  await expect(
    compiled({ type: "doc", dir: "content", schema: own }, { dir: "content", pages }),
  ).rejects.toThrow(
    "[Fumapress] content/b.md doesn't match the schema of its collection:\n  - title: only Hello",
  );
});

test("a macro that was not compiled says where to call it", () => {
  expect(() => defineDocs({ dir: "content" })).toThrow(
    "[Fumapress] `defineDocs()` was not compiled. It is a macro: the Vite plugin of Fumapress compiles it in `press.config`",
  );
  expect(() => defineCollections({ type: "meta", dir: "content" })).toThrow(
    "`defineCollections()` was not compiled",
  );
});
