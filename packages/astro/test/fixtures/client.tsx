"use client";
import { useState, type ReactNode } from "react";
import type * as PageTree from "fumadocs-core/page-tree";

export function Counter({ initial = 0 }: { initial?: number; onClick?: () => void }) {
  const [count, setCount] = useState(initial);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      count {count}
    </button>
  );
}

export function Star() {
  return <span>star</span>;
}

export function Frame({ children }: { children?: ReactNode }) {
  return <section data-frame="">{children}</section>;
}

export function TreeName({ tree }: { tree: PageTree.Root }) {
  return <span>{tree.name}</span>;
}

export function TestDialog(_props: object): null {
  return null;
}

export function TestLayout({ children }: { children?: ReactNode }) {
  return children;
}
