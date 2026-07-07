import path from "node:path";
import type { MintlifyApiSource } from "./schema";

/** resolve `api.openapi` / `api.asyncapi` sources from docs.json into file paths or URLs */
export function collectApiSources(
  value: MintlifyApiSource | MintlifyApiSource[] | undefined,
  root: string,
): string[] {
  if (!value) return [];
  const entries = Array.isArray(value) ? value : [value];

  return entries.map((entry) => {
    const source = typeof entry === "string" ? entry : entry.source;

    if (/^https?:\/\//.test(source)) return source;
    return path.resolve(root, source);
  });
}
