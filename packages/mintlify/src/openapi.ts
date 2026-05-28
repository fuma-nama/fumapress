import path from "node:path";
import type { MintlifyDocsJson, MintlifyOpenAPISource } from "./schema";
import type { ReadMintlifyDocsOptions } from "./read-config";

export interface MintlifyOpenAPIOptions extends ReadMintlifyDocsOptions {
  /** Resolve relative OpenAPI paths from this directory. Default: project root */
  specRoot?: string;
}

function normalizeSource(source: MintlifyOpenAPISource, root: string): string {
  if (typeof source === "string") {
    return path.isAbsolute(source) ? source : path.resolve(root, source);
  }

  return path.isAbsolute(source.source) ? source.source : path.resolve(root, source.source);
}

function collectSources(
  value: MintlifyOpenAPISource | MintlifyOpenAPISource[] | undefined,
  root: string,
): string[] {
  if (!value) return [];
  const entries = Array.isArray(value) ? value : [value];
  return entries.map((entry) => normalizeSource(entry, root));
}

export function resolveMintlifyOpenAPIInput(
  docs: MintlifyDocsJson,
  options: MintlifyOpenAPIOptions = {},
): string[] {
  const api = docs.api;
  if (!api) return [];

  const root = path.resolve(options.root ?? process.cwd());
  const specRoot = path.resolve(options.specRoot ?? root);

  return [...collectSources(api.openapi, specRoot), ...collectSources(api.asyncapi, specRoot)];
}

export function mintlifyOpenAPIOptions(
  docs: MintlifyDocsJson,
  options: MintlifyOpenAPIOptions = {},
) {
  const input = resolveMintlifyOpenAPIInput(docs, options);

  return {
    input: input.length > 0 ? input : undefined,
    proxyUrl: docs.api?.playground?.proxy === false ? undefined : "/api/proxy",
  };
}

export function mintlifyOpenAPISourceOptions(docs: MintlifyDocsJson) {
  const openapi = docs.api?.openapi;
  const entry = Array.isArray(openapi) ? openapi[0] : openapi;

  if (entry && typeof entry !== "string" && entry.directory) {
    return {
      baseDir: entry.directory,
      meta: true as const,
    };
  }

  return {
    meta: true as const,
  };
}

export function hasOpenAPIPlugin(plugins: Array<{ name?: string }>): boolean {
  return plugins.some((plugin) => plugin.name === "core:openapi");
}

export function assertMintlifyOpenAPI(
  docs: MintlifyDocsJson,
  plugins: Array<{ name?: string }>,
  options: MintlifyOpenAPIOptions = {},
) {
  const api = docs.api;
  if (!api?.openapi && !api?.asyncapi) return;

  if (!hasOpenAPIPlugin(plugins)) {
    console.warn(
      "[Fumapress Mintlify] docs.json defines api.openapi/asyncapi but openapiPlugin() is not configured",
    );
    return;
  }

  const input = resolveMintlifyOpenAPIInput(docs, options);
  if (input.length === 0) return;

  console.info(
    `[Fumapress Mintlify] OpenAPI specs from docs.json: ${input.map((item) => path.relative(options.root ?? process.cwd(), item)).join(", ")}`,
  );
}
