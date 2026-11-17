/**
 * Stands in for `react` in the bundled parts of Fumadocs: the content loader only reaches it for `cache()`, the
 * request memoization of server components, which Vue has no equivalent of.
 */
export function cache<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}
