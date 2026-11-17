/**
 * Stands in for `react-dom/server.edge` in the bundled content loader: only `serializePageTree()` reaches it, to
 * render React nodes of a page tree. The trees of this package hold text, and it serializes them itself.
 */
export function renderToString(): never {
  throw new Error("[Fumapress] React is not available in @fumapress/vue.");
}
