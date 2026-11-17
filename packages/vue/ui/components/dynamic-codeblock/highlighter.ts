import type { Highlighter } from "@fumapress/vue/highlight";

let instance: Promise<Highlighter> | undefined;

/**
 * The highlighter of every dynamic code block, loaded by the first one like `defaultShikiFactory.getOrInit()` of the
 * source: a page without one never downloads it.
 */
export function getHighlighter(): Promise<Highlighter> {
  if (instance) return instance;
  const created = import("@fumapress/vue/highlight").then((mod) => mod.createHighlights());
  created.catch(() => {
    if (instance === created) instance = undefined;
  });
  return (instance = created);
}
