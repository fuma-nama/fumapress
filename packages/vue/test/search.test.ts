import { expect, test } from "vitest";
import { searchIndex, type SearchEntry } from "../src/core/search";

const index: SearchEntry[] = [
  {
    url: "/install",
    title: "Installation",
    description: "Set up the package.",
    structuredData: {
      headings: [{ id: "requirements", content: "Requirements" }],
      contents: [
        { heading: "requirements", content: "Node.js 24 or later is required." },
        { content: "Run the install command of your package manager." },
      ],
    },
  },
  {
    url: "/plugins",
    title: "Plugins",
    structuredData: {
      headings: [{ id: "install-a-plugin", content: "Install a plugin" }],
      contents: [{ heading: "install-a-plugin", content: "Add it to the list." }],
    },
  },
  { url: "/about", title: "About" },
];

test("lists a page, then its headings and texts that match", () => {
  expect(searchIndex(index, "requir")).toEqual([
    { id: "/install", url: "/install", type: "page", content: "Installation" },
    {
      id: "/install#requirements",
      url: "/install#requirements",
      type: "heading",
      content: "Requirements",
    },
    {
      id: "/install:0",
      url: "/install#requirements",
      type: "text",
      content: "Node.js 24 or later is required.",
    },
  ]);
});

test("ranks a title match first, and needs every word of the query", () => {
  const results = searchIndex(index, "INSTALL");
  expect(results.filter((result) => result.type === "page").map((result) => result.url)).toEqual([
    "/install",
    "/plugins",
  ]);

  expect(searchIndex(index, "install plugin").map((result) => result.id)).toEqual([
    "/plugins",
    "/plugins#install-a-plugin",
  ]);
  expect(searchIndex(index, "install nothing")).toEqual([]);
  expect(searchIndex(index, "  ")).toEqual([]);
});
