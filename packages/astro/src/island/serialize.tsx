import {
  createElement,
  Fragment,
  isValidElement,
  StrictMode,
  Suspense,
  type DOMAttributes,
  type FunctionComponent,
  type ReactElement,
  type ReactNode,
} from "react";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { DevalueError, stringify } from "devalue";
import { renderToStaticMarkup } from "react-dom/server";
import { prerender } from "react-dom/static";
import { components } from "virtual:fumapress/island";
import type * as PageTree from "fumadocs-core/page-tree";
import { deserializePageTree, type SerializedPageTree } from "fumadocs-core/source/client";
import { pageTrees, type IslandNode } from "./island";
import { getReference } from "./references";

/** the props of `Island.astro` */
export interface IslandData {
  /** the island tree, see {@link IslandNode} */
  tree: string;
  /** static HTML, or Astro content rendered with the provider of the island; slot `s0` is the first */
  slots: (string | AstroComponentFactory)[];
  /** the URLs of the page tree files in the island, the island fetches them */
  pageTrees: string[];
}

/** the URLs of page tree files by their page tree: the island gets a page tree by identity from its file, rather than in its props */
export const pageTreeFiles = new WeakMap<object, string>();

/** the file of a page tree, the island renders the deserialized tree on the server too, like in the browser */
export function registerPageTree(
  tree: PageTree.Root,
  url: string,
  serialized: SerializedPageTree,
): void {
  pageTreeFiles.set(tree, url);
  pageTrees.set(url, deserializePageTree(serialized));
}

/** a slot of the island rendered by Astro */
export class Slot {
  constructor(readonly name: string) {}
}

/** React content in props, as the island tree */
class Tree {
  constructor(readonly nodes: IslandNode[]) {}
}

/** the default slot of `Island.astro`, the children of its Astro component */
export function AstroSlot(): null {
  return null;
}

interface AstroContentProps {
  /** like `<Content />` of a collection page, it receives the `provider` prop */
  component: AstroComponentFactory;
}

/** Astro content in React content, like the body of a collection page: Astro renders it into a slot of the island */
export function AstroContent(_props: AstroContentProps): null {
  return null;
}

function isAstroContent(node: ReactElement): node is ReactElement<AstroContentProps> {
  return node.type === AstroContent;
}

/** the props of elements, as the serializer reads them */
interface ElementProps extends Pick<
  DOMAttributes<Element>,
  "children" | "dangerouslySetInnerHTML"
> {
  [key: string]: unknown;
}

/** the names of MDX components, the island gets them from the same MDX components */
const names = new Map<unknown, string>();
for (const [name, component] of Object.entries(components)) {
  // the layout of content
  if (name !== "wrapper" && !names.has(component)) names.set(component, name);
}

const unserializable = Symbol("unserializable");

/**
 * Render React content as a press island: client components (`'use client'`) and MDX components hydrate, React renders the other components on the server.
 *
 * Highlighted code, {@link AstroContent} and the parts the island can't receive, like class components, render once by Astro as slots.
 */
export async function serializeIsland(node: ReactNode): Promise<IslandData> {
  const nodes: IslandNode[] = [];
  const slots: IslandData["slots"] = [];
  const pageTrees: string[] = [];
  await serialize(node, nodes, slots, false);
  try {
    const tree = stringify(nodes, {
      slot: (value) => value instanceof Slot && value.name,
      tree: (value) => value instanceof Tree && value.nodes,
      ref: getReference,
      pageTree(value) {
        const url = typeof value === "object" && value !== null && pageTreeFiles.get(value);
        if (url && !pageTrees.includes(url)) pageTrees.push(url);
        return url;
      },
    });
    return { tree, slots, pageTrees };
  } catch (error) {
    if (!(error instanceof DevalueError)) throw error;
    throw new Error(
      `[Fumapress] the props of client components must be serializable, ${error.message} at "${error.path}".`,
      { cause: error },
    );
  }
}

/** add the island nodes of `node` to `out`, `pre` for the children of code blocks */
async function serialize(
  node: ReactNode,
  out: IslandNode[],
  slots: IslandData["slots"],
  pre: boolean,
): Promise<void> {
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") {
    out.push(String(node));
    return;
  }
  // `null`, booleans, and functions like render props
  if (typeof node !== "object" || node === null) return;
  if ("then" in node) return serialize(await node, out, slots, pre);
  if (Symbol.iterator in node) {
    for (const child of node) await serialize(child, out, slots, pre);
    return;
  }
  if (!isValidElement<ElementProps>(node)) return;
  if (isAstroContent(node)) {
    out.push(slot(slots, node.props.component));
    return;
  }

  const { type, props } = node;
  if (type === AstroSlot) {
    out.push(new Slot("children"));
    return;
  }
  if (type === Fragment || type === Suspense || type === StrictMode)
    return serialize(props.children, out, slots, pre);

  if (typeof type === "string") {
    const { children, ...rest } = props;
    if (pre && type === "code") {
      const { dangerouslySetInnerHTML: html, ...code } = rest;
      // highlighted code is rendered once by Astro, rather than also being in the island props
      if (html || isStatic(children)) {
        out.push([
          type,
          hostProps(code),
          slot(slots, html ? String(html.__html) : renderToStaticMarkup(children)),
        ]);
        return;
      }
    }
    const nodes: IslandNode[] = [];
    await serialize(children, nodes, slots, type === "pre");
    out.push([type, hostProps(rest), ...nodes]);
    return;
  }

  // MDX components hydrate by name, client components by reference
  const name = names.get(type);
  const reference = name === undefined && getReference(type) !== undefined;
  if (name !== undefined || reference) {
    // refs are of the browser
    const { children, ref: _ref, ...rest } = props;
    const islandProps =
      typeof children === "function" ? unserializable : await toIslandProps(rest, slots);
    if (islandProps !== unserializable) {
      const nodes: IslandNode[] = [];
      await serialize(children, nodes, slots, name === "pre");
      out.push([1, name ?? type, islandProps, ...nodes]);
      return;
    }
    if (reference)
      throw new Error(
        `[Fumapress] the props of the client component <${typeof type === "function" ? type.name : "memo"}> must be serializable, they can't have functions other than client components.`,
      );
  }

  // other function components render on the server like server components, their output can have components
  if (isFunctionComponent(type)) {
    const result = await call(type, props);
    if (result) return serialize(await result.value, out, slots, pre);
  }

  // class components, `memo()`, context providers and the others are rendered by React
  out.push(slot(slots, await render(node)));
}

/** class components have `isReactComponent` on their prototype */
function isFunctionComponent(type: ReactElement["type"]): type is FunctionComponent<ElementProps> {
  return typeof type === "function" && !type.prototype?.isReactComponent;
}

/** call a function component in a render of React, so it can use hooks, `undefined` when it throws */
async function call(
  component: FunctionComponent<ElementProps>,
  props: ElementProps,
): Promise<{ value: ReturnType<FunctionComponent> } | undefined> {
  let result: { value: ReturnType<FunctionComponent> } | undefined;
  const element = createElement(() => {
    result = { value: component(props) };
    return null;
  });
  try {
    renderToStaticMarkup(createElement(Suspense, null, element));
    // it suspended, like `use()` of async data, React calls it again when the data is ready
    if (!result) await prerender(element, { onError() {} });
  } catch {
    // when React renders it instead, it waits for suspending components, and throws real errors
    return;
  }
  return result;
}

/** the HTML of a React node */
async function render(node: ReactNode): Promise<string> {
  const { prelude } = await prerender(node);
  return new Response(prelude).text();
}

function slot(slots: IslandData["slots"], content: IslandData["slots"][number]): Slot {
  slots.push(content);
  return new Slot(`s${slots.length - 1}`);
}

/** event handlers and refs are of the browser, like React rendering HTML */
function hostProps(props: Record<string, unknown>): Record<string, unknown> | 0 {
  let out: Record<string, unknown> | 0 = 0;
  for (const key in props) {
    const value = props[key];
    if (key !== "ref" && typeof value !== "function") (out ||= {})[key] = value;
  }
  return out;
}

/** a prop of a component in the island: client components are references, elements are island trees */
async function toIslandProp(value: unknown, slots: IslandData["slots"]): Promise<unknown> {
  if (typeof value === "function") return getReference(value) ? value : unserializable;
  if (
    typeof value !== "object" ||
    value === null ||
    value instanceof Slot ||
    pageTreeFiles.has(value)
  )
    return value;
  if (isValidElement(value)) {
    const nodes: IslandNode[] = [];
    await serialize(value, nodes, slots, false);
    return new Tree(nodes);
  }
  if (getReference(value)) return value;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      const prop = await toIslandProp(item, slots);
      if (prop === unserializable) return unserializable;
      out.push(prop);
    }
    return out;
  }

  const prototype = Object.getPrototypeOf(value);
  // values of other classes like dates and maps, the component renders on the server when the island can't receive them
  if (prototype !== Object.prototype && prototype !== null)
    return isSerializable(value) ? value : unserializable;
  return toIslandProps(value, slots);
}

function isSerializable(value: object): boolean {
  try {
    stringify(value);
    return true;
  } catch {
    return false;
  }
}

/** the props of a component in the island */
async function toIslandProps(
  value: object,
  slots: IslandData["slots"],
): Promise<Record<string, unknown> | typeof unserializable> {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const prop = await toIslandProp(item, slots);
    if (prop === unserializable) return unserializable;
    out[key] = prop;
  }
  return out;
}

/** HTML elements and text only */
function isStatic(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return typeof node !== "function";
  if (Array.isArray(node)) {
    for (const child of node) if (!isStatic(child)) return false;
    return true;
  }
  if (!isValidElement<ElementProps>(node)) return false;
  const { type, props } = node;
  return (typeof type === "string" || type === Fragment) && isStatic(props.children);
}
