"use client";
import { useChat } from "@ai-sdk/react";
import { AIChatPanel, AIChatProvider, AIChatSearch, useAIChat } from "@fumadocs/ai-chat";
import { LayoutPropsProvider } from "@fumapress/core/ui/docs";
import { DefaultChatTransport } from "ai";
import { useI18n } from "fumadocs-ui/contexts/i18n";
import type { ReactNode } from "react";
import type { ChatUIMessage } from "@/chat";

export { AIChatPanel, AIChatTrigger, useAIChat } from "@fumadocs/ai-chat";

/**
 * The chat of the `api` endpoint, `aiPlugin()` adds it around every page. `Ctrl + /` opens it, `Escape` closes it.
 * Layouts dock it from the `aiChat` of `useLayoutProps()`: Docs and Notebook add a floating Ask AI button, Glass and
 * Spacious show their own.
 */
export function AIChat({ api, children }: { api: string; children: ReactNode }) {
  const { locale } = useI18n();
  const chat = useChat<ChatUIMessage>({
    id: "search",
    throttle: 40,
    transport: new DefaultChatTransport({ api }),
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
      <ChatLayoutProps>{children}</ChatLayoutProps>
    </AIChatProvider>
  );
}

function ChatLayoutProps({ children }: { children: ReactNode }) {
  const { open, setOpen } = useAIChat();
  const aiChat = { open, onOpenChange: setOpen, panel: <AIChatPanel />, trigger: true };

  return <LayoutPropsProvider value={{ aiChat }}>{children}</LayoutPropsProvider>;
}

function renderPart(part: ChatUIMessage["parts"][number], live: boolean) {
  if (part.type === "tool-search") return <AIChatSearch part={part} live={live} />;
}
