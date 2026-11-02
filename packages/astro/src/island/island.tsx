import { parse } from "devalue";
import { createElement, Fragment, lazy, Suspense, type ComponentType, type ReactNode } from "react";
import type { MDXComponents } from "mdx/types";
import registry from "virtual:fumapress/client-references";
import { modules, type ClientReference } from "./references";
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

/** the components of client references, by key and name */
const clientComponents = new Map<string, ComponentType>();

/** load a client component module in the browser */
async function load(key: string): Promise<Record<string, unknown>> {
  const importer = registry[key];
  if (importer) return importer();
  // the dev server discovers client components as it renders them, the registry of this page lags behind
  if (import.meta.hot) location.reload();
  throw new Error(`[Fumapress] the client component module "${key}" is not in the build.`);
}

/** a client component, it renders in `Suspense`: until its module is loaded in the browser */
function resolveReference([key, name]: ClientReference): ComponentType<Record<string, unknown>> {
  const id = `${key}#${name}`;
  let component = clientComponents.get(id);
  if (component) return component;

  // registered on the server
  const module = modules.get(key);
  const Component = module
    ? (module[name] as ComponentType)
    : lazy(async () => ({ default: (await load(key))[name] as ComponentType }));
  component = (props) => createElement(Suspense, null, createElement(Component, props));
  clientComponents.set(id, component);
  return component;
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

  return function PressIsland({ tree, ...slots }: PressIslandProps) {
    const nodes: IslandNode[] = parse(tree, {
      // own slots only, names like `constructor` aren't slots
      slot: (name: string) => (Object.hasOwn(slots, name) ? slots[name] : undefined),
      tree: (children: IslandNode[]) => createElement(Fragment, null, ...children.map(toReact)),
      ref: resolveReference,
    });
    return createElement(Fragment, null, ...nodes.map(toReact));
  };
}
