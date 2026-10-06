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
import type { AppShape, PressPlugin } from "fumapress";
import { createSearch, type PageDocument, type SearchOptions } from "./search";
import z from "zod";
import type { MergedDocumentSearchResults } from "flexsearch";
import { aiTranslations } from "./i18n";
import type { DocsLayoutContextData } from "fumapress/layouts/docs";
import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import { type ElementType, isValidElement } from "react";

export type ChatUIMessage = UIMessage<
  never,
  { client: AIChatClientData & { locale: string | null } },
  { search: InferUITool<SearchTool> }
>;

type Awaitable<T> = T | Promise<T>;

export interface AIOptions<C extends AppShape = AppShape> extends SearchOptions<C> {
  /** @default true */
  configureUI?: boolean;

  model: LanguageModel;
  systemPrompt?: string;

  /** you can add logic for ratelimiting, validation etc.  */
  beforeRequest?: (request: Request) => Awaitable<Response | undefined>;
}

/** add AI chat */
export function aiPlugin<C extends AppShape = AppShape>(
  options: AIOptions<NoInfer<C>>,
): PressPlugin<C> {
  const { configureUI = true } = options;

  return {
    name: "ai:main",
    async init() {
      if (this.translationsConfig) {
        // ensure language pack works correctly without calling `extend()`
        this.translationsConfig.extend(aiTranslations());
      }

      if (configureUI) {
        const { AIChatLayout } = await import("./components/chat");
        const { DocsLayout } = await import("./components/layouts/docs");
        const { DocsLayout: NotebookLayout } = await import("./components/layouts/notebook");

        /**
         * render the layout element from a client component, with the chat as its `aiChat` option.
         *
         * @param layout - the layout as a client component, defaults to the element type: Glass and Spacious layouts are client components already, and importing Spacious layout (Base UI only) would fail Radix UI builds.
         * @param trigger - add a floating trigger, for layouts without their own
         */
        const initUI = (
          data: DocsLayoutContextData<C>,
          layout: ElementType | undefined,
          trigger: boolean,
        ) => {
          (data.layoutInterceptors ??= []).push(({ props, next }) => {
            const element = next(props);
            if (!isValidElement<DocsLayoutProps>(element)) return element;

            return (
              <AIChatLayout
                layout={layout ?? (element.type as ElementType)}
                trigger={trigger}
                {...element.props}
              />
            );
          });
        };

        initUI((this.data["core:docs-layout"] ??= {}), DocsLayout, true);
        initUI(
          (this.data["core:notebook-layout"] ??= {}) as DocsLayoutContextData<C>,
          NotebookLayout,
          true,
        );
        initUI(
          (this.data["core:glass-layout"] ??= {}) as DocsLayoutContextData<C>,
          undefined,
          false,
        );
        initUI(
          (this.data["core:spacious-layout"] ??= {}) as DocsLayoutContextData<C>,
          undefined,
          false,
        );
      }
    },
    createPages({ createApi }) {
      if (this.mode === "static") {
        throw new Error(
          "[Fumapress] the @fumapress/ai plugin is not compatible with mode: 'static'",
        );
      }

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
        render: "dynamic",
        handlers: {
          async POST(req: Request) {
            if (beforeRequest) {
              const res = await beforeRequest(req);
              if (res) return res;
            }

            const reqJson: { messages: ChatUIMessage[] } = await req.json();
            let locale: string | null = null;

            const result = streamText({
              model,
              stopWhen: stepCountIs(5),
              tools: {
                search: searchTool,
              },
              system: systemPrompt,
              messages: await convertToModelMessages<ChatUIMessage>(reqJson.messages, {
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
