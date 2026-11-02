import type { SlotItem } from "@fumapress/core";
import { createElement, type ReactNode } from "react";

/** the items of a slot, in order */
export function renderSlot(items: SlotItem[] = []): ReactNode {
  return items.map(({ component, props }, key) => createElement(component, { key, ...props }));
}

/** `children` inside the items of a wrapper slot, the first item outermost */
export function wrapSlot(items: SlotItem[] = [], children: ReactNode): ReactNode {
  return items.reduceRight<ReactNode>(
    (out, { component, props }) => createElement(component, props, out),
    children,
  );
}
