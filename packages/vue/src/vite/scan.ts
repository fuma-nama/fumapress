import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * A file or folder starting with `_` holds what pages import, like a partial or a component: it is not a page. The
 * collections of `press.config` leave them out too (`HIDDEN` of `./macro`).
 */
export function isHidden(file: string): boolean {
  return file.split(/[\\/]/).some((part) => part.startsWith("_"));
}

/**
 * The route of a page file: `index.vue` is `/`, `blog/[slug].vue` is `/blog/[slug]`, where `[slug]` matches a segment
 * and `[...path]` the rest, like in the routes of plugins.
 */
export function toRoutePath(file: string): string {
  const segments = file
    .replace(/\.vue$/, "")
    .split("/")
    .filter((segment) => segment !== "index");
  return `/${segments.join("/")}`;
}

/** how late a segment is matched: a fixed one first, then a param, then a rest param */
const rank = (segment: string | undefined) =>
  segment === undefined ? -1 : segment.startsWith("[...") ? 2 : segment.startsWith("[") ? 1 : 0;

/**
 * The order routes are matched in: the first one matching a URL wins, so a page with a fixed path comes before one
 * with a param at the same place, and a rest param last.
 */
export function compareRoutes(a: string, b: string): number {
  const left = a.split("/").filter(Boolean);
  const right = b.split("/").filter(Boolean);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = rank(left[i]) - rank(right[i]);
    if (difference !== 0) return difference;
    if (left[i] !== right[i]) return left[i]! < right[i]! ? -1 : 1;
  }
  return 0;
}

/** the Vue pages of a directory, by route path, in the order they are matched; none when it doesn't exist */
export async function scanPages(dir: string): Promise<{ path: string; absolutePath: string }[]> {
  let entries: string[];
  try {
    entries = await readdir(dir, { recursive: true });
  } catch {
    return [];
  }

  return entries
    .map((entry) => entry.split(path.sep).join("/"))
    .filter((file) => file.endsWith(".vue") && !isHidden(file))
    .map((file) => ({ path: toRoutePath(file), absolutePath: path.join(dir, file) }))
    .sort((a, b) => compareRoutes(a.path, b.path));
}
