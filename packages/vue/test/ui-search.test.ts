// @vitest-environment jsdom
// The text of search results comes from pages, which a remote content source lets anyone write. Fumadocs UI renders it
// with React, which never runs the scripts and handlers of what it renders; Vue does. So `parseResults()` keeps only
// elements and attributes that can't run code, and the dialog renders nothing else.
import type { Element, Nodes, Root } from "hast";
import { afterEach, expect, test, vi } from "vitest";
import { createApp, h, nextTick, shallowRef } from "vue";
import { routerKey, type Router } from "@fumapress/vue/client";
import { parseResults } from "../ui/core/search/parse";
import type { SortedResult } from "../ui/core/search";
import type { SearchResultRecord, SearchResultTable } from "../ui/core/search/use-search";
import { SearchDialog, SearchDialogList } from "../ui/components/dialog/search";
import { format, stubBrowser } from "./ui/dom";

stubBrowser();

/** content a page can have, each trying to run code once rendered */
const hostile = [
  "<script>alert(1)</script>",
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  "<style>body { display: none }</style>",
  '<img src="x" onerror="alert(1)">',
  '<div onanimationstart="alert(1)" style="animation: spin 1s">spin</div>',
  'a <span onpointerenter="alert(1)">hover</span> b',
  '<a href="javascript:alert(1)" onclick="alert(1)">link</a>',
  "[markdown link](javascript:alert(1))",
  '<svg onload="alert(1)"><script>alert(1)</script></svg>',
  '<math><mtext><img src="x" onerror="alert(1)"></mtext></math>',
  '<form action="javascript:alert(1)"><button formaction="javascript:alert(1)">go</button></form>',
  '<object data="javascript:alert(1)"></object><embed src="javascript:alert(1)">',
  '<details open ontoggle="alert(1)"><summary>more</summary>hidden</details>',
  '<template><img src="x" onerror="alert(1)"></template>',
  '<Callout onclick="alert(1)" type="warn">careful</Callout>',
  '<x-widget onclick="alert(1)">widget</x-widget>',
  '<td onmouseover="alert(1)" align="right">cell</td>',
];

const result = (content: string, i = 0, type: SortedResult["type"] = "text"): SortedResult => ({
  id: `r${i}`,
  url: "/docs/page",
  type,
  content,
});

function* elements(node: Nodes): Generator<Element> {
  if (node.type === "element") yield node;
  if ("children" in node) for (const child of node.children) yield* elements(child);
}

const text = (node: Nodes): string =>
  node.type === "text" ? node.value : "children" in node ? node.children.map(text).join("") : "";

function contentOf(source: string): Root {
  const [item] = parseResults([result(source)]);
  return (item as SearchResultRecord).hastContent;
}

/** what the sanitizer lets through: anything else can run code, or load something */
const safeElements = new Set(
  "a b blockquote br code custom del div em h1 h2 h3 h4 h5 h6 hr i kbd li mark ol p pre s span strong sub sup table tbody td tfoot th thead tr u ul".split(
    " ",
  ),
);
const safeProperty = (element: Element, key: string) =>
  key === "className" ||
  key.startsWith("data") ||
  (element.tagName === "custom" && key === "tagName") ||
  (["td", "th"].includes(element.tagName) && ["align", "colSpan", "rowSpan"].includes(key));

test.each(hostile)("parsing %s keeps no element or attribute that runs code", (source) => {
  for (const element of elements(contentOf(source))) {
    expect(safeElements, element.tagName).toContain(element.tagName);
    for (const key of Object.keys(element.properties)) {
      expect(safeProperty(element, key), `${element.tagName} ${key}`).toBe(true);
    }
  }
});

test("removed elements lose their content, unwrapped ones keep their text", () => {
  // the text of scripts, styles and controls is code or a label of what's removed
  expect(text(contentOf("<script>alert(1)</script>"))).toBe("");
  expect(text(contentOf("<style>body { display: none }</style>"))).toBe("");
  expect(text(contentOf("before <button>go</button> after"))).toBe("before  after");
  // other elements are unwrapped: the text of a page stays searchable
  expect(
    text(contentOf('<details open ontoggle="x"><summary>more</summary>hidden</details>')),
  ).toBe("morehidden");
  expect(text(contentOf('<x-widget onclick="x">widget</x-widget>'))).toBe("widget");
  expect(text(contentOf('a <span onpointerenter="x">hover</span> b'))).toBe("a hover b");
});

test("formatting, highlights and unknown elements are kept", () => {
  const root = contentOf(
    "**bold** _em_ `code` <del>old</del> <mark>hit</mark> <kbd>K</kbd> <sub>2</sub> " +
      '<Callout type="warn" data-kind="note" class="box">careful</Callout>',
  );
  const tags = [...elements(root)].map((element) => element.tagName);
  expect(tags).toEqual(["p", "strong", "em", "code", "del", "mark", "kbd", "sub", "custom"]);

  // an element unknown to HTML, like a component of MDX, becomes `custom` with its name, so the dialog can show it
  const custom = [...elements(root)].find((element) => element.tagName === "custom")!;
  expect(custom.properties).toEqual({ tagName: "callout", dataKind: "note", className: ["box"] });
  expect(text(custom)).toBe("careful");
});

test("rows of a table are gathered under its header, in the page they belong to", () => {
  const table = "| Prop | Type |\n| --- | --- |\n| `a` | `string` |";
  const row = "| Prop | Type |\n| --- | --- |\n| `b` | `number` |";
  const items = parseResults([
    result("Page", 0, "page"),
    { ...result(table, 1), table: "props" },
    { ...result(row, 2), table: "props" },
    // the same table id in another page is another table
    result("Other page", 3, "page"),
    { ...result(row, 4), table: "props" },
  ]);

  expect(items.map((item) => item.type)).toEqual(["page", "table", "page", "table"]);
  const first = items[1] as SearchResultTable;
  expect(first.columns).toBe(2);
  expect(text(first.header!)).toContain("Prop");
  expect(first.rows.map((row) => row.id)).toEqual(["r1", "r2"]);
  expect(text(first.rows[1]!.hastContent)).toContain("number");
  expect((items[3] as SearchResultTable).rows.map((row) => row.id)).toEqual(["r4"]);
});

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
});

test("the dialog renders hostile results as text, without code to run", async () => {
  const issues: string[] = [];
  vi.spyOn(console, "warn").mockImplementation((...args) => void issues.push(format(args)));
  vi.spyOn(console, "error").mockImplementation((...args) => void issues.push(format(args)));

  const results = [
    result("Hostile page", 0, "page"),
    ...hostile.map((content, i) => result(content, i + 1)),
    {
      ...result("| a | b |\n| --- | --- |\n| <img src=x onerror=alert(1)> | `x` |", 99),
      table: "t",
    },
  ];
  const router = {
    route: shallowRef({ path: "/" }),
    resolve: () => undefined,
  } as unknown as Router;
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({
    render: () =>
      h(
        SearchDialog,
        { open: false, search: "alert", data: { query: "alert", items: parseResults(results) } },
        () => h(SearchDialogList),
      ),
  });
  app.provide(routerKey, router);
  app.config.warnHandler = (message) => void issues.push(message);
  app.mount(container);
  cleanups.push(() => {
    app.unmount();
    container.remove();
  });
  await nextTick();

  expect(issues).toEqual([]);
  expect(container.querySelectorAll('[role="option"]').length).toBe(results.length);
  expect(
    container.querySelector("script, iframe, style, img, svg, math, object, embed, form, button"),
  ).toBeNull();
  for (const element of container.querySelectorAll("*")) {
    for (const { name, value } of element.attributes) {
      expect(name, element.outerHTML).not.toMatch(/^(on|href$|src|action$|formaction$)/i);
      expect(value, element.outerHTML).not.toMatch(/javascript:/i);
    }
  }
  // what the results say is still shown
  expect(container.textContent).toContain("hover");
  expect(container.textContent).toContain("careful");
});
