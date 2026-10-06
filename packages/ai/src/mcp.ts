import { createMcpHandler, type Implementation, McpServer } from "@modelcontextprotocol/server";
import { registerSourceTools } from "fumadocs-core/mcp";
import type { LoaderOutput } from "fumadocs-core/source";
import { llms } from "fumadocs-core/source/llms";
import type { AppContext, AppShape, PressPlugin } from "fumapress";
import { z } from "zod";
import { createSearch, type SearchOptions } from "./search";

export interface McpOptions<C extends AppShape = AppShape> extends SearchOptions<C> {
  /**
   * Base path for MCP routes.
   *
   * @default "/mcp"
   */
  path?: string;

  server?: Partial<Implementation>;

  /**
   * Register additional tools on the MCP server.
   */
  tools?: (this: AppContext<C>, server: McpServer) => void | Promise<void>;
}

export function mcpPlugin<C extends AppShape = AppShape>(
  options: McpOptions<NoInfer<C>> = {},
): PressPlugin<C> {
  const { path = "/mcp", server: serverInfo, tools: registerTools } = options;

  return {
    name: "ai:mcp",
    async createPages({ createApi }) {
      if (this.mode === "static") {
        throw new Error("[Fumapress] MCP server is not compatible with static mode");
      }

      const { execute, pageToIndex } = createSearch(options, this);
      // the loader config of a generic app can't be inferred
      const getLoader = this.getLoader as () => Promise<LoaderOutput>;
      const docsLlms = llms(getLoader, {
        async renderPage(page) {
          const doc = await pageToIndex(page as C["page"]);
          return doc ? `# ${doc.title} (${doc.url})\n\n${doc.content}` : "";
        },
      });

      // stateless, every request is served by a new server instance
      const handler = createMcpHandler(async () => {
        const server = new McpServer({
          ...serverInfo,
          name: serverInfo?.name ?? this.siteConfig.name,
          version: serverInfo?.version ?? "1.0.0",
        });

        server.registerTool(
          "search",
          {
            title: "Search",
            description: "Search the docs content and return raw JSON results",
            inputSchema: z.object({
              query: z.string().describe("the search query"),
              limit: z.int().min(1).max(100).optional().describe("maximum number of results"),
              ...(this.i18nConfig && {
                locale: z
                  .literal(this.i18nConfig.languages as [string, ...string[]])
                  .describe("the locale to search & return search results")
                  .default(this.i18nConfig.defaultLanguage as string),
              }),
            }),
          },
          async ({ query, limit = 10, locale }) => {
            const results = await execute(query, limit, locale as string | undefined);

            return {
              content: results.map((v) => ({ type: "text", text: JSON.stringify(v.doc, null, 2) })),
            };
          },
        );

        // `list_pages` and `get_page`
        registerSourceTools(server, getLoader, docsLlms);

        if (registerTools) {
          await registerTools.call(this, server);
        }

        return server;
      });

      createApi({
        render: "dynamic",
        path,
        handlers: {
          all: (req: Request) => handler.fetch(req),
        },
      });
    },
  };
}
