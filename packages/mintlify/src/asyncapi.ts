import {
  createAsyncAPI,
  type AsyncAPIOptions,
  type AsyncAPIServer,
} from "@fumadocs/asyncapi/server";
import type { MintlifyDocsJson } from "./schema";
import { readMintlifyDocs } from "./read-config";
import { collectApiSources } from "./api-sources";

export interface MintlifyAsyncAPIOptions extends AsyncAPIOptions {
  /** path to `docs.json` */
  configPath?: string;
  /** project directory, default to cwd */
  root?: string;
  /** override the content of `docs.json` */
  _config?: MintlifyDocsJson;
}

export function createMintlifyAsyncAPI(options: MintlifyAsyncAPIOptions = {}): AsyncAPIServer {
  const { configPath, root = process.cwd(), _config, ...overrides } = options;
  const docs = _config ?? readMintlifyDocs({ path: configPath, root });
  const input = collectApiSources(docs.api?.asyncapi, root);

  return createAsyncAPI({
    input: input.length > 0 ? input : undefined,
    ...overrides,
  });
}
