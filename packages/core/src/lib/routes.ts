/** Route helpers for plugins deriving outputs from the pages of `createPage()` */
import type { FC } from "react";

export type RouteParams = Record<string, string | string[]>;

export interface CreatedPage {
  render: "static" | "dynamic";
  path: string;
  staticPaths?: readonly string[] | readonly string[][];
  component: FC<never>;
  exactPath?: boolean;
  unstable_sourceFile?: string;
}

enum ParameterType {
  Single,
  Nested,
}

export interface PrecompiledRoutePath {
  regex: RegExp;
  params: Map<string, ParameterType>;
  /** non-group segments, longer = more specific */
  length: number;
  /** compares equal-length routes segment by segment, smaller = higher priority */
  priority: number;
}

export function precompileRoutePath(routePath: string): PrecompiledRoutePath {
  const segments = routePath.split("/").filter(Boolean);
  const params = new Map<string, ParameterType>();
  let length = 0;
  let priority = 0;
  let pattern = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.startsWith("(") && seg.endsWith(")")) continue;

    length++;
    priority *= 10;
    if (seg.startsWith("[...") && seg.endsWith("]")) {
      const name = seg.slice(4, -1);
      priority += 3;
      pattern += i === segments.length - 1 ? `(?:\\/(?<${name}>.*))?` : `\\/(?<${name}>.*)`;
      params.set(name, ParameterType.Nested);
    } else if (seg.startsWith("[") && seg.endsWith("]")) {
      const name = seg.slice(1, -1);
      priority += 2;
      pattern += `\\/(?<${name}>[^/]+)`;
      params.set(name, ParameterType.Single);
    } else {
      priority += 1;
      pattern += `\\/${RegExp.escape(seg)}`;
    }
  }

  return {
    regex: new RegExp(`^${pattern || "\\/"}$`),
    length,
    priority,
    params,
  };
}

export function matchRoutePath(
  precompiled: PrecompiledRoutePath,
  pathname: string,
): RouteParams | null {
  const match = precompiled.regex.exec(pathname);
  if (match === null) return null;

  const params: RouteParams = {};
  for (const [k, type] of precompiled.params) {
    const v = match.groups![k] ?? "";

    if (type === ParameterType.Single) {
      params[k] = v;
    } else {
      params[k] = v.length === 0 ? [] : v.split("/");
    }
  }

  return params;
}

/**
 * The concrete pathname (without route groups) and route params of one entry in `staticPaths`,
 * where its values fill the dynamic segments of `routePath` in order.
 */
export function expandStaticPath(
  segments: string[],
  values: readonly string[],
): { pathname: string; params: RouteParams } {
  const params: RouteParams = {};
  let pathname = "";
  let i = 0;

  for (const seg of segments) {
    if (seg.startsWith("(") && seg.endsWith(")")) continue;

    if (seg.startsWith("[...") && seg.endsWith("]")) {
      const rest = values.slice(i);
      i = values.length;
      params[seg.slice(4, -1)] = rest;
      for (const value of rest) pathname += "/" + value;
    } else if (seg.startsWith("[") && seg.endsWith("]")) {
      const value = values[i++]!;
      params[seg.slice(1, -1)] = value;
      pathname += "/" + value;
    } else {
      pathname += "/" + seg;
    }
  }

  return { pathname: pathname.length === 0 ? "/" : pathname, params };
}
