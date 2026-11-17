import { expect, test } from "vitest";
import { parseFrontmatter } from "../src/vite/frontmatter";
import { compareRoutes, toRoutePath } from "../src/vite/scan";

test("maps page files to route paths", () => {
  expect(toRoutePath("index.vue")).toBe("/");
  expect(toRoutePath("about.vue")).toBe("/about");
  expect(toRoutePath("blog/index.vue")).toBe("/blog");
  expect(toRoutePath("blog/[slug].vue")).toBe("/blog/[slug]");
  expect(toRoutePath("files/[...path].vue")).toBe("/files/[...path]");

  // a page with a fixed path is matched before one with a param, and a rest param last
  expect(
    ["/[...path]", "/[slug]", "/about", "/blog/[slug]", "/blog/new", "/"].sort(compareRoutes),
  ).toEqual(["/", "/about", "/blog/new", "/blog/[slug]", "/[slug]", "/[...path]"]);
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
