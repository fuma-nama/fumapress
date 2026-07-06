import { createOpenAPI, type OpenAPIOptions, type OpenAPIServer } from "fumadocs-openapi/server";
import type { MintlifyApiSource, MintlifyDocsJson } from "./schema";
import { readMintlifyDocs } from "./read-config";
import { collectApiSources } from "./api-sources";

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
    const input = collectApiSources(docs.api.openapi, root);

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

export type { MintlifyApiSource };
