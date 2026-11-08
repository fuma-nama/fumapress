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
import type { MDXComponents } from "mdx/types";
import { renderToStaticMarkup } from "react-dom/server";
import { prerender } from "react-dom/static";
import { components } from "virtual:fumapress/island";
import type { IslandNode } from "./island";
import { getReference, isFileKey } from "./references";

/** the props of `Island.astro` */
export interface IslandData {
  /** the island tree, see {@link IslandNode} */
  tree: string;
  /** static HTML, or Astro content rendered with the provider of the island; slot `s0` is the first */
  slots: (string | AstroSlot)[];
  /** the URLs of the page tree files in the island, the island fetches them */
  pageTrees: string[];
}

/** a slot of the island rendered by Astro */
export class Slot {
  constructor(readonly name: string) {}
}

/** React content in props, as the island tree */
class Tree {
  constructor(readonly nodes: IslandNode[]) {}
}

/** Astro content in a slot of the island */
export interface AstroSlot {
  /** like `<Content />` of a collection page, it receives the `provider` and `components` props */
  component: AstroComponentFactory;
  components?: MDXComponents;
}

/** an `.astro` file as the type of an element */
export function isAstroComponent(type: unknown): type is AstroComponentFactory {
  return typeof type === "function" && "isAstroComponentFactory" in type;
}

/** without `component`, the default slot of `Island.astro`, the children of its Astro component */
type AstroContentProps = Partial<AstroSlot>;

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

/** where a part Astro or React renders goes in the island tree */
type ToSlot = (content: IslandData["slots"][number]) => IslandNode;

/** a component of the page has no slots of Astro: HTML stays in the tree, Astro content has nowhere to go */
function inlineSlot(content: IslandData["slots"][number]): IslandNode {
  if (typeof content !== "string")
    throw new Error("[Fumapress] the props of an `.astro` layout can't have Astro content.");
  return [
    "div",
    {
      style: { display: "contents" },
      dangerouslySetInnerHTML: { __html: content },
      suppressHydrationWarning: true,
    },
  ];
}

/**
 * Render React content as a press island: client components (`'use client'`) and MDX components hydrate, React renders the other components on the server.
 *
 * @param inline - keep the parts below in the tree, for an island without slots of Astro
 *
 * Highlighted code, {@link AstroContent} and the parts the island can't receive, like class components, render once by Astro as slots.
 */
export async function serializeIsland(node: ReactNode, inline = false): Promise<IslandData> {
  const nodes: IslandNode[] = [];
  const slots: IslandData["slots"] = [];
  const pageTrees: string[] = [];
  const toSlot: ToSlot = inline
    ? inlineSlot
    : (content) => {
        slots.push(content);
        return new Slot(`s${slots.length - 1}`);
      };
  await serialize(node, nodes, toSlot, false);
  try {
    const tree = stringify(nodes, {
      slot: (value) => value instanceof Slot && value.name,
      tree: (value) => value instanceof Tree && value.nodes,
      ref(value) {
        const reference = getReference(value);
        if (reference && isFileKey(reference[0]) && !pageTrees.includes(reference[0]))
          pageTrees.push(reference[0]);
        return reference;
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
  toSlot: ToSlot,
  pre: boolean,
): Promise<void> {
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") {
    out.push(String(node));
    return;
  }
  // `null`, booleans, and functions like render props
  if (typeof node !== "object" || node === null) return;
  if ("then" in node) return serialize(await node, out, toSlot, pre);
  if (Symbol.iterator in node) {
    for (const child of node) await serialize(child, out, toSlot, pre);
    return;
  }
  if (!isValidElement<ElementProps>(node)) return;
  if (isAstroContent(node)) {
    const { component, components } = node.props;
    out.push(component ? toSlot({ component, components }) : new Slot("children"));
    return;
  }

  const { type, props } = node;
  if (type === Fragment && node.key !== null) {
    const nodes: IslandNode[] = [];
    await serialize(props.children, nodes, toSlot, pre);
    out.push(["", { key: node.key }, ...nodes]);
    return;
  }
  if (type === Fragment || type === Suspense || type === StrictMode)
    return serialize(props.children, out, toSlot, pre);

  if (typeof type === "string") {
    const { children, ...rest } = props;
    if (pre && type === "code") {
      const { dangerouslySetInnerHTML: html, ...code } = rest;
      // highlighted code is rendered once by Astro, rather than also being in the island props
      if (html || isStatic(children)) {
        out.push([
          type,
          hostProps(code),
          toSlot(html ? String(html.__html) : renderToStaticMarkup(children)),
        ]);
        return;
      }
    }
    const nodes: IslandNode[] = [];
    await serialize(children, nodes, toSlot, type === "pre");
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
      typeof children === "function" ? unserializable : await toIslandProps(rest, toSlot);
    if (islandProps !== unserializable) {
      const nodes: IslandNode[] = [];
      await serialize(children, nodes, toSlot, name === "pre");
      out.push([1, name ?? type, islandProps, ...nodes]);
      return;
    }
    if (reference)
      throw new Error(
        `[Fumapress] the props of the client component <${typeof type === "function" ? type.name : "memo"}> must be serializable, they can't have functions other than client components.`,
      );
  }

  if (isAstroComponent(type))
    throw new Error(
      `[Fumapress] the Astro component <${type.name}> is in React content: \`ui.renderPage\` can return one as the layout of a page, React renders other content.`,
    );

  // other function components render on the server like server components, their output can have components
  if (isFunctionComponent(type)) {
    const result = await call(type, props);
    if (result) return serialize(await result.value, out, toSlot, pre);
  }

  // class components, `memo()`, context providers and the others are rendered by React
  out.push(toSlot(await render(node)));
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
async function toIslandProp(value: unknown, toSlot: ToSlot): Promise<unknown> {
  if (typeof value === "function") return getReference(value) ? value : unserializable;
  if (typeof value !== "object" || value === null || value instanceof Slot) return value;
  if (isValidElement(value)) {
    const nodes: IslandNode[] = [];
    await serialize(value, nodes, toSlot, false);
    return new Tree(nodes);
  }
  if (getReference(value)) return value;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      const prop = await toIslandProp(item, toSlot);
      if (prop === unserializable) return unserializable;
      out.push(prop);
    }
    return out;
  }

  const prototype = Object.getPrototypeOf(value);
  // values of other classes like dates and maps, the component renders on the server when the island can't receive them
  if (prototype !== Object.prototype && prototype !== null)
    return isSerializable(value) ? value : unserializable;
  return toIslandProps(value, toSlot);
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
  toSlot: ToSlot,
): Promise<Record<string, unknown> | typeof unserializable> {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const prop = await toIslandProp(item, toSlot);
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
