"use client";
import { createContext, use, type ComponentType } from "react";

/** the props of a page the React root gets through the island, the others can be unserializable */
export const layoutRootKeys = [
  "lang",
  "layoutProps",
  "type",
  "slugs",
  "pageData",
  "toc",
  "slots",
] as const;

export const LayoutRootContext = createContext<{
  component: ComponentType<any>;
  props: object;
} | null>(null);

/** the place of the React root in the island: in the root provider and `layout-wrapper`, below the `banner` items, with the props of the page */
export function LayoutRoot(props: object) {
  const root = use(LayoutRootContext)!;
  return <root.component {...props} {...root.props} />;
}
