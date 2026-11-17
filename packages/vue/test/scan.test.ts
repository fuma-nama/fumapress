import { expect, test } from "vitest";
import { parseFrontmatter } from "../src/build/frontmatter";
import { toRoutePath } from "../src/build/scan";

test("maps page files to route paths", () => {
  expect(toRoutePath("index.vue")).toBe("/");
  expect(toRoutePath("about.vue")).toBe("/about");
  expect(toRoutePath("blog/index.vue")).toBe("/blog");
  expect(toRoutePath("blog/[slug].vue")).toBe("/blog/:slug");
  expect(toRoutePath("files/[...path].vue")).toBe("/files/:path(.*)*");
});

test("parses frontmatter", () => {
  expect(parseFrontmatter("---\ntitle: Hello\nfull: true\n---\n\n## Body\n")).toEqual({
    data: { title: "Hello", full: true },
    body: "\n## Body\n",
  });
  expect(parseFrontmatter("## No frontmatter\n")).toEqual({
    data: {},
    body: "## No frontmatter\n",
  });
});
