"use client";
import {
  cloneElement,
  isValidElement,
  Suspense,
  use,
  type ReactElement,
  type ReactNode,
} from "react";
import { preload } from "react-dom";
import type * as PageTree from "fumadocs-core/page-tree";

declare global {
  /** the files of `router/page-tree` by URL, the SSR environment reads them in the process of the RSC environment */
  var PAGE_TREE_FILES: Map<string, Promise<Uint8Array<ArrayBuffer>>> | undefined;
}

/** a page tree in the RSC payload: its `children` are {@link pageTreeChildren} until {@link PageTreeFiles} gives it the ones of its file */
export interface PageTreeReference extends PageTree.Root {
  /** the URL of its file */
  $file: string;
}

export const pageTreeChildren = new Proxy<PageTree.Node[]>([], {
  get(target, key, receiver) {
    if (key === "length")
      throw new Error(
        "[Fumapress] the children of a page tree can't be passed to client components alone, pass the tree instead.",
      );
    return Reflect.get(target, key, receiver);
  },
});

const trees = new Map<string, Promise<PageTree.Root>>();

async function decode(url: string): Promise<PageTree.Root> {
  if (import.meta.env.SSR) {
    const { createFromReadableStream } = await import("@vitejs/plugin-rsc/ssr");
    return createFromReadableStream(new Response(await global.PAGE_TREE_FILES?.get(url)).body!);
  }

  const { createFromFetch } = await import("@vitejs/plugin-rsc/browser");
  return createFromFetch(
    fetch(url).then((res) => {
      if (!res.ok)
        throw new Error(`[Fumapress] failed to fetch the page tree ${url}: ${res.status}`);
      return res;
    }),
  );
}

function load(url: string): Promise<PageTree.Root> {
  let tree = trees.get(url);
  if (!tree) {
    tree = decode(url);
    tree.catch(() => trees.delete(url));
    trees.set(url, tree);
  }
  return tree;
}

function isReference(value: object): value is PageTreeReference {
  return "children" in value && value.children === pageTreeChildren;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  return Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * `value` with the page trees in it from their files, the same `value` without any: a cloned element is validated by React
 * again, as if it was written in a list. The content under a layout has none and isn't visited.
 */
function provideTrees(value: unknown): unknown {
  if (typeof value !== "object" || value === null || value === pageTreeChildren) return value;

  if (Array.isArray(value)) {
    let out: unknown[] | undefined;
    for (const [i, item] of value.entries()) {
      const provided = provideTrees(item);
      if (provided !== item) (out ??= [...value])[i] = provided;
    }
    return out ?? value;
  }

  // Flight sends an element as lazy while its client modules load, reading it suspends like rendering it
  if ("_init" in value && "_payload" in value) {
    const lazy = value as { _init(payload: unknown): unknown; _payload: unknown };
    const element = lazy._init(lazy._payload);
    const provided = provideTrees(element);
    return provided === element ? value : provided;
  }

  if (isValidElement(value)) {
    const element = value as ReactElement<Record<string, unknown>>;
    const { children, ...props } = element.props;
    // keep the suspense of its content in the boundary
    if (element.type === Suspense)
      return cloneElement(
        element,
        undefined,
        <PageTreeFiles>{children as ReactNode}</PageTreeFiles>,
      );

    const changes = provideProps(props);
    if (changes !== props) return cloneElement(element, changes);

    const provided = provideTrees(children);
    if (provided === children) return element;
    return Array.isArray(provided)
      ? cloneElement(element, undefined, ...provided)
      : cloneElement(element, { children: provided });
  }

  if (isReference(value)) {
    preload(value.$file, { as: "fetch", crossOrigin: "anonymous" });
    const { children, fallback } = use(load(value.$file));
    return { ...value, children, fallback };
  }

  return isPlainObject(value) ? provideProps(value) : value;
}

function provideProps(props: Record<string, unknown>): Record<string, unknown> {
  let out: Record<string, unknown> | undefined;
  for (const key in props) {
    const provided = provideTrees(props[key]);
    if (provided !== props[key]) (out ??= { ...props })[key] = provided;
  }
  return out ?? props;
}

/** gives the page trees in `children` to their layouts, a tree is fetched once rather than in the RSC payload of every page */
export function PageTreeFiles({ children }: { children: ReactNode }) {
  return provideTrees(children) as ReactNode;
}
