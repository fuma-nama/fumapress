import { parse } from "yaml";

const pattern = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** the YAML frontmatter of a Markdown file, and the content after it */
export function parseFrontmatter(source: string): { data: Record<string, unknown>; body: string } {
  const match = pattern.exec(source);
  if (!match) return { data: {}, body: source };
  const data: unknown = parse(match[1]!);
  return {
    data: typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {},
    body: source.slice(match[0].length),
  };
}
