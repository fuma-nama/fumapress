import path from "node:path";
import { createOpenAPI, type OpenAPIOptions, type OpenAPIServer } from "fumadocs-openapi/server";
import type { MintlifyDocsJson, MintlifyOpenAPISource } from "./schema";
import { readMintlifyDocs } from "./read-config";

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

export interface MintlifyOpenAPIOptions extends OpenAPIOptions {
  /** path to `docs.json` */
  configPath?: string;
  /** project directory, default to cwd */
  root?: string;
  /** override the content of `docs.json` */
  _config?: MintlifyDocsJson;
}

export function createMintlifyOpenAPI(options: MintlifyOpenAPIOptions = {}): OpenAPIServer {
  const { configPath, root = process.cwd(), _config, ...overrides } = options;
  const docs = _config ?? readMintlifyDocs({ path: configPath, root });

  function getOpenAPIOptions(): OpenAPIOptions | null {
    if (!docs.api) return null;
    const input = collectSources(docs.api.openapi, root);

    return {
      input: input.length > 0 ? input : undefined,
      proxyUrl: docs.api?.playground?.proxy === false ? undefined : "/api/proxy",
    };
  }

  return createOpenAPI({
    ...getOpenAPIOptions(),
    ...overrides,
  });
}
