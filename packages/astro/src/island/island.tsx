import { parse } from "devalue";
import { createElement, Fragment, Suspense, use, type ComponentType, type ReactNode } from "react";
import type { MDXComponents } from "mdx/types";
import { deserializePageTree, type SerializedPageTree } from "fumadocs-core/source/client";
import registry from "virtual:fumapress/client-references";
import { isFileKey, modules, type ClientReference } from "./references";
import type { Slot } from "./serialize";

export interface PressIslandProps {
  /** the root children from `serializeIsland()`, as {@link IslandNode} */
  tree: string;
  /** slots rendered by Astro, `children` is the default slot */
  [slot: string]: unknown;
}

/**
 * A node of the island tree from `serializeIsland()`: text, a slot, an HTML element, or a component with an MDX component name or a client component.
 *
 * Elements are created with their React props as they are.
 */
export type IslandNode =
  | string
  | Slot
  | [tagName: string, props: Record<string, unknown> | 0, ...children: IslandNode[]]
  | [
      jsx: 1,
      type: string | ComponentType,
      props: Record<string, unknown>,
      ...children: IslandNode[],
    ];

/** the loads of client references in the browser, by key; forgotten when they fail: a later render (like after a navigation) tries again */
const loading = new Map<string, Promise<void>>();

async function fetchPageTree(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[Fumapress] failed to fetch the page tree ${url}: ${res.status}`);
  const serialized: SerializedPageTree = await res.json();
  return { tree: deserializePageTree(serialized) };
}

/** import a client component module in the browser into `modules`, or fetch a file */
function load(key: string): Promise<void> {
  const promise = loading.get(key);
  if (promise) return promise;
  const importer = isFileKey(key) ? () => fetchPageTree(key) : registry[key];
  if (importer) {
    const out = importer().then(
      (module) => void modules.set(key, module),
      (error: unknown) => {
        loading.delete(key);
        throw error;
      },
    );
    loading.set(key, out);
    return out;
  }

  // the dev server discovers client components as it renders them, the registry of this page lags behind
  if (import.meta.hot) location.reload();
  const missing = Promise.reject(
    new Error(`[Fumapress] the client component module "${key}" is not in the build.`),
  );
  loading.set(key, missing);
  return missing;
}

/**
 * Create the island rendering React content of the server, with the MDX components of the content.
 */
export function createIsland(components: MDXComponents) {
  function toReact(node: IslandNode): ReactNode {
    // text, and slots replaced by their content when parsed
    if (!Array.isArray(node)) return node as ReactNode;
    if (node[0] === 1) {
      const [, type, props, ...children] = node;
      return createElement(
        typeof type === "string" ? (components[type] as ComponentType) : type,
        props,
        ...children.map(toReact),
      );
    }

    const [tagName, props, ...children] = node;
    return createElement(tagName, props || null, ...children.map(toReact));
  }

  /** client references are the exports of their modules, it suspends until the missing modules are loaded */
  function IslandTree({ tree, ...slots }: PressIslandProps) {
    // the browser's loads, done or not: React replays a suspended render with the promises of the last
    // one by position, so a finished one left out would stand in for the next unfinished one
    const promises = new Set<Promise<void>>();
    let missing = false;
    const nodes: IslandNode[] = parse(tree, {
      // own slots only, names like `constructor` aren't slots
      slot: (name: string) => (Object.hasOwn(slots, name) ? slots[name] : undefined),
      tree: (children: IslandNode[]) =>
        missing ? null : createElement(Fragment, null, ...children.map(toReact)),
      ref: ([key, name]: ClientReference) => {
        const module = modules.get(key);
        if (!module || loading.has(key)) promises.add(load(key));
        if (module) return module[name];
        missing = true;
      },
    });
    // they run in parallel, they all started while parsing
    for (const promise of promises) use(promise);
    return createElement(Fragment, null, ...nodes.map(toReact));
  }

  return function PressIsland(props: PressIslandProps) {
    return createElement(Suspense, null, createElement(IslandTree, props));
  };
}
