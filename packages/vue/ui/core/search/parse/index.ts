import type { Nodes, Root } from "hast";
import { fromDom, gfmTable, gfmTableHtml, micromark, type Options } from "@fumapress/vue/markdown";
import type { SortedResult } from "../index";
import type { SearchResultItem, SearchResultTable } from "../use-search";

const options: Options = {
  allowDangerousHtml: true,
  extensions: [gfmTable()],
  htmlExtensions: [gfmTableHtml()],
};

/**
 * Parse the Markdown content of results with the HTML parser of browsers, and gather the rows of a table after its first row, tables are scoped to the page before them.
 */
export function parseResults(results: SortedResult[]): SearchResultItem[] {
  const items: SearchResultItem[] = [];
  const tables = new Map<string, SearchResultTable>();
  const template = document.createElement("template");

  for (const result of results) {
    if (result.type === "page") tables.clear();
    template.innerHTML = micromark(result.content, options);
    const record = { ...result, hastContent: toHast(template.content) };
    const table = template.content.firstElementChild;
    if (!(table instanceof HTMLTableElement) || table.rows.length === 0) {
      items.push(record);
      continue;
    }

    let entry = result.table ? tables.get(result.table) : undefined;
    if (!entry) {
      const columns = table.rows[0]!.cells.length;
      // a row without header is parsed as the header row
      const body = table.tHead && table.tBodies.item(0);
      body?.remove();
      entry = {
        type: "table",
        id: result.id,
        columns,
        header: body ? toHast(template.content) : undefined,
        rows: [],
      };
      items.push(entry);
      if (result.table) tables.set(result.table, entry);
    }
    entry.rows.push(record);
  }

  return items;
}

function toHast(fragment: DocumentFragment) {
  const root = fromDom(fragment, { afterTransform }) as Root;
  return { ...root, children: sanitize(root.children) } as Root;
}

/**
 * The elements a result renders: text formatting, tables, and the `custom` elements of records. The text of a result
 * comes from pages, which can be anyone's with a remote source, and React, which Fumadocs UI is written for, never
 * runs the scripts and handlers it renders, while Vue does. So anything else is unwrapped, and only attributes that
 * can't run code are kept.
 */
const allowedElements = new Set(
  "a b blockquote br code custom del div em h1 h2 h3 h4 h5 h6 hr i kbd li mark ol p pre s span strong sub sup table tbody td tfoot th thead tr u ul".split(
    " ",
  ),
);

/** removed with their content */
const removedElements = new Set(
  "applet audio base button embed form frame frameset head iframe img input link math meta noscript object picture script select source style svg template textarea title video".split(
    " ",
  ),
);

function isSafeProperty(tagName: string, key: string): boolean {
  if (key === "className" || key.startsWith("data")) return true;
  if (tagName === "custom") return key === "tagName";
  return (
    (tagName === "td" || tagName === "th") &&
    (key === "align" || key === "colSpan" || key === "rowSpan")
  );
}

function sanitize<T extends Nodes>(nodes: T[]): T[] {
  return nodes.flatMap((node): T[] => {
    if (node.type === "text") return [node];
    if (node.type !== "element" || removedElements.has(node.tagName)) return [];

    const children = sanitize(node.children);
    if (!allowedElements.has(node.tagName)) return children as T[];
    const properties = Object.fromEntries(
      Object.entries(node.properties).filter(([key]) => isSafeProperty(node.tagName, key)),
    );
    return [{ ...node, properties, children }];
  });
}

/** elements unknown to HTML, like the JSX elements of records, become `custom` elements with a `tagName` property */
function afterTransform(node: Node, hast: Nodes) {
  if (hast.type === "element" && node instanceof HTMLUnknownElement) {
    hast.properties.tagName = hast.tagName;
    hast.tagName = "custom";
  }
}
