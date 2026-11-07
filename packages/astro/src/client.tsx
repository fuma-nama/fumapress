import { createElement, type ComponentType } from "react";
import { PressIsland } from "virtual:fumapress/island";
import { LayoutRootContext, type layoutRootKeys } from "./ui/layout-root";

export { selectTreeRoot } from "@fumapress/core/page-tree";
export { useLayoutProps } from "@fumapress/core/ui/docs";

/**
 * The React root of an `.astro` layout from `ui.renderPage`, for `client:load`: `component` hydrates in the root provider of
 * the site with the props of the page, and the ones of the layout. Its slots are props, `children` is the default slot.
 *
 * @example
 * ```astro
 * <DocsRoot client:load island={Astro.props.island}><slot /></DocsRoot>
 * ```
 */
export function createIsland<P extends object>(component: ComponentType<P>) {
  return function PressLayout({
    island,
    ...props
  }: Omit<P, (typeof layoutRootKeys)[number]> & { island: string }) {
    if (!island)
      throw new Error(
        `[Fumapress] pass the \`island\` prop of the \`.astro\` layout to <${component.displayName ?? component.name}>.`,
      );

    return createElement(
      LayoutRootContext,
      { value: { component, props } },
      createElement(PressIsland, { tree: island }),
    );
  };
}
