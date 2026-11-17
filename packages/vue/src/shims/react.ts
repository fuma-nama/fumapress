/**
 * Stands in for `react` in the bundled parts of Fumadocs: the content loader only reaches it for `cache()`, the
 * request memoization of server components, which Vue has no equivalent of.
 */
export function cache<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}

// the types that the bundled declarations of Fumadocs name: a site has no React, its nodes are any value
export type ReactNode = unknown;
export type ComponentType<_P = {}> = unknown;
export type ComponentProps<_T> = Record<string, unknown>;
export interface RefObject<T> {
  current: T;
}
export namespace JSX {
  export type IntrinsicElements = Record<string, Record<string, unknown>>;
}
