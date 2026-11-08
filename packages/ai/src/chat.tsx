import type { AIChatClientData } from "@fumadocs/ai-chat";
import {
  convertToModelMessages,
  type InferUITool,
  type LanguageModel,
  stepCountIs,
  streamText,
  type Tool,
  tool,
  type UIMessage,
} from "ai";
import type { AppShape, Awaitable, Plugin } from "@fumapress/core";
import { createSearch, type PageDocument, type SearchOptions } from "./search";
import z from "zod";
import type { MergedDocumentSearchResults } from "flexsearch";
import { aiTranslations } from "./i18n";

/** what the UI sends: other roles and parts are the server's, a `file` part makes it download the URL */
const messageParts = new Set(["text", "data-client", "reasoning", "step-start", "tool-search"]);

function isChatMessage({ role, parts }: ChatUIMessage): boolean {
  return (
    (role === "user" || role === "assistant") &&
    Array.isArray(parts) &&
    parts.every((part) => messageParts.has(part.type))
  );
}

export type ChatUIMessage = UIMessage<
  never,
  { client: AIChatClientData & { locale: string | null } },
  { search: InferUITool<SearchTool> }
>;

export interface AIOptions<C extends AppShape = AppShape> extends SearchOptions<C> {
  /** add the chat around every page, docked by every layout reading `useLayoutProps()` @default true */
  configureUI?: boolean;

  model: LanguageModel;
  systemPrompt?: string;

  /** you can add logic for ratelimiting, validation etc.  */
  beforeRequest?: (request: Request) => Awaitable<Response | undefined>;
}

/** AI chat: the `/api/ai` endpoint, and the chat that layouts dock through the `aiChat` of `useLayoutProps()` */
export function aiPlugin<C extends AppShape = AppShape>(
  options: AIOptions<NoInfer<C>>,
): Plugin<C, { slots: "ai:chat" }> {
  const { configureUI = true } = options;

  return {
    name: "ai:main",
    translations: aiTranslations(),
    async slots({ page }) {
      if (!configureUI || page) return;
      const { AIChat } = await import("./components/chat");
      return [
        {
          name: "ai:chat",
          region: "layout-wrapper",
          component: AIChat,
          props: { api: this.withBase("/api/ai") },
          order: -1,
        },
      ];
    },
    routes({ createApi }) {
      const {
        model,
        beforeRequest,
        systemPrompt = [
          `You are an AI assistant for "${this.siteConfig.name}" documentation site.`,
          "Use the `search` tool to retrieve relevant docs context before answering when needed.",
          'A user message may begin with [Client Context], the page they are reading. For questions about "this page", search its title.',
          "The `search` tool returns raw JSON results from documentation. Use those results to ground your answer and cite sources as markdown links using the document `url` field when available.",
          "If you cannot find the answer in search results, say you do not know and suggest a better search query.",
        ].join("\n"),
      } = options;

      const searchServer = createSearch(options, this);
      const searchTool = tool({
        description:
          "Search the docs content and return raw JSON results.\nIt will always return search results in the preferred locale selected by user.",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(100).default(10),
        }),
        contextSchema: z.object({
          locale: z.string().nullable(),
        }),
        async execute({ query, limit }, options) {
          return searchServer.execute(query, limit, options.context.locale);
        },
      });

      createApi({
        path: "/api/ai",
        async POST(req) {
          if (beforeRequest) {
            const res = await beforeRequest(req);
            if (res) return res;
          }

          const { messages } = (await req.json()) as { messages: ChatUIMessage[] };
          if (!Array.isArray(messages) || !messages.every(isChatMessage))
            return new Response("invalid messages", { status: 400 });
          let locale: string | null = null;

          const result = streamText({
            model,
            stopWhen: stepCountIs(5),
            tools: {
              search: searchTool,
            },
            system: systemPrompt,
            messages: await convertToModelMessages<ChatUIMessage>(messages, {
              tools: {
                search: searchTool,
              },
              convertDataPart(part) {
                if (part.type === "data-client") {
                  locale = part.data.locale;

                  return {
                    type: "text",
                    text: `[Client Context: ${JSON.stringify(part.data)}]`,
                  };
                }
              },
            }),
            toolsContext: {
              search: {
                locale,
              },
            },
            toolChoice: "auto",
          });

          return result.toUIMessageStreamResponse();
        },
      });
    },
  };
}

export type SearchTool = Tool<
  {
    query: string;
    limit: number;
  },
  MergedDocumentSearchResults<PageDocument>
>;
