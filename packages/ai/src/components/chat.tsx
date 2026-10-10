"use client";
import { useChat } from "@ai-sdk/react";
import {
  AIChatPanel,
  AIChatProvider,
  AIChatSearch,
  AIChatTrigger,
  useAIChat,
} from "@fumadocs/ai-chat";
import { DefaultChatTransport } from "ai";
import { useI18n } from "fumadocs-ui/contexts/i18n";
import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { ElementType, ReactNode } from "react";
import type { ChatUIMessage } from "@/chat";
import { joinPaths } from "@/lib/pathname";

export { AIChatPanel, AIChatTrigger, useAIChat } from "@fumadocs/ai-chat";

/**
 * The chat state of the `/api/ai` endpoint, `Ctrl + /` opens it and `Escape` closes it.
 */
export function AIChat({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const chat = useChat<ChatUIMessage>({
    id: "search",
    throttle: 40,
    transport: new DefaultChatTransport({
      api: joinPaths("/", import.meta.env.BASE_URL, "/api/ai"),
    }),
  });

  return (
    <AIChatProvider
      chat={chat}
      renderPart={renderPart}
      toMessage={(text) => ({
        role: "user",
        parts: [
          {
            type: "data-client",
            data: { location: location.href, title: document.title, locale: locale ?? null },
          },
          { type: "text", text },
        ],
      })}
    >
      {children}
    </AIChatProvider>
  );
}

function renderPart(part: ChatUIMessage["parts"][number], live: boolean) {
  if (part.type === "tool-search") return <AIChatSearch part={part} live={live} />;
}

/**
 * Render a layout with the chat as its `aiChat` option, `trigger` adds a floating one for layouts without their own.
 */
export function AIChatLayout({
  layout: Layout,
  trigger = false,
  ...props
}: DocsLayoutProps & { layout: ElementType; trigger?: boolean }) {
  return (
    <AIChat>
      <ChatLayout layout={Layout} {...props} />
      {trigger && <AIChatTrigger />}
    </AIChat>
  );
}

function ChatLayout({ layout: Layout, ...props }: DocsLayoutProps & { layout: ElementType }) {
  const { open, setOpen } = useAIChat();

  return <Layout {...props} aiChat={{ open, onOpenChange: setOpen, panel: <AIChatPanel /> }} />;
}
