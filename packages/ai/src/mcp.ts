import { llms } from "fumadocs-core/source/llms";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppContext, ConfigContext, ServerPlugin } from "fumapress";
import { z } from "zod";
import { createSearch, type SearchOptions } from "./search";

function joinPathname(...paths: string[]) {
  const segs: string[] = [];
  for (let p of paths) {
    if (p.startsWith("/")) p = p.slice(1);
    if (p.endsWith("/")) p = p.slice(0, -1);
    if (p.length > 0) segs.push(p);
  }

  return "/" + segs.join("/");
}

export interface McpOptions<C extends ConfigContext = ConfigContext> extends SearchOptions<C> {
  /**
   * Base path for MCP routes.
   *
   * The streamable HTTP endpoint will be available at `{path}/mcp`.
   *
   * @default ""
   */
  path?: string;

  server?: {
    name?: string;
    version?: string;
  };

  /**
   * Preferred locale for search results.
   */
  locale?: string | null;

  /**
   * Register additional tools on the MCP server.
   */
  tools?: (this: AppContext<C>, server: McpServer) => void | Promise<void>;

  /**
   * Disable the SSE transport endpoint.
   *
   * @default true
   */
  disableSSE?: boolean;
}

export function mcpPlugin<C extends ConfigContext = ConfigContext>(
  options: McpOptions<NoInfer<C>> = {},
): ServerPlugin<C> {
  const {
    path = "",
    server: serverInfo,
    locale = null,
    disableSSE = true,
    tools: registerTools,
  } = options;

  return {
    name: "ai:mcp",
    async createPages({ createApi }) {
      if (this.mode === "static") {
        throw new Error("[Fumapress] MCP server is not compatible with static mode");
      }

      const { execute, pageToIndex } = createSearch(options, this);
      const { createMcpHandler } = await import("mcp-handler");

      const handler = createMcpHandler(
        async (server) => {
          server.registerTool(
            "search",
            {
              title: "Search",
              description:
                "Search the docs content and return raw JSON results.\nIt will always return search results in the preferred locale selected by user.",
              inputSchema: z.object({
                query: z.string().describe("the search query"),
                limit: z
                  .number()
                  .int()
                  .min(1)
                  .max(100)
                  .optional()
                  .describe("maximum number of results"),
              }),
            },
            async ({ query, limit = 10 }) => {
              const results = await execute(query, limit, locale);

              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(results, null, 2),
                  },
                ],
              };
            },
          );

          server.registerTool(
            "get_page",
            {
              title: "Get Page",
              description: "Fetch the full content of a documentation page",
              inputSchema: z.object({
                path: z.string().describe("the page URL path (e.g. /docs/getting-started)"),
              }),
            },
            async ({ path: pagePath }) => {
              const source = await this.getLoader();
              const segments = pagePath.split("/").filter((v) => v.length > 0);
              let lang: string | undefined;

              if (this.i18nConfig && segments.length > 0) {
                const languages = Object.keys(this.i18nConfig.languages);
                if (languages.includes(segments[0]!)) {
                  lang = segments.shift();
                }
              }

              const page = source.getPage(segments, lang);
              if (!page) {
                return {
                  content: [
                    {
                      type: "text",
                      text: `Page not found: ${pagePath}`,
                    },
                  ],
                  isError: true,
                };
              }

              const doc = await pageToIndex(page);

              return {
                content: [
                  {
                    type: "text",
                    text: doc ? `# ${doc.title} (${doc.url})\n\n${doc.content}` : "",
                  },
                ],
              };
            },
          );

          server.registerTool(
            "list_pages",
            {
              title: "List Pages",
              description: "List all documentation pages as a structured index",
              inputSchema: z.object({}),
            },
            async () => {
              const source = await this.getLoader();

              return {
                content: [
                  {
                    type: "text",
                    text: llms(source).index(),
                  },
                ],
              };
            },
          );

          if (registerTools) {
            await registerTools.call(this, server);
          }
        },
        {
          serverInfo: {
            name: serverInfo?.name ?? this.siteConfig.name,
            version: serverInfo?.version ?? "1.0.0",
          },
        },
        {
          basePath: path,
          disableSse: disableSSE,
        },
      );

      createApi({
        render: "dynamic",
        path: joinPathname(path, "mcp"),
        handlers: {
          all: handler,
        },
      });
    },
  };
}
