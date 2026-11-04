"use client";
import { useChat } from "@ai-sdk/react";
import { AIChatPanel, AIChatProvider, AIChatSearch, useAIChat } from "@fumadocs/ai-chat";
import { useTranslations } from "@fuma-translate/react";
import { DefaultChatTransport } from "ai";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { useI18n } from "fumadocs-ui/contexts/i18n";
import { AIChatOptionsProvider } from "fumadocs-ui/layouts/shared";
import { MessageCircleIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ChatUIMessage } from "@/chat";

export { AIChatPanel, AIChatTrigger, useAIChat } from "@fumadocs/ai-chat";

/**
 * The chat of the `api` endpoint, docked by the layouts inside it. The `ai` page action and `Ctrl + /` open it, `Escape`
 * closes it; `AIChatTrigger` is a floating button for your own `ui.renderPage`.
 * `aiPlugin()` adds it around every page.
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
      <DockedChat>{children}</DockedChat>
    </AIChatProvider>
  );
}

function DockedChat({ children }: { children: ReactNode }) {
  const { open, setOpen } = useAIChat();

  return (
    <AIChatOptionsProvider value={{ open, onOpenChange: setOpen, panel: <AIChatPanel /> }}>
      {children}
    </AIChatOptionsProvider>
  );
}

function renderPart(part: ChatUIMessage["parts"][number], live: boolean) {
  if (part.type === "tool-search") return <AIChatSearch part={part} live={live} />;
}

/** the `ai` page action: opens the chat of `AIChat` */
export function AIChatAction() {
  const { open, setOpen } = useAIChat();
  const t = useTranslations({ note: "AI chat" });

  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={buttonVariants({
        variant: "secondary",
        size: "sm",
        className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground",
      })}
    >
      <MessageCircleIcon aria-hidden />
      {t("Ask AI")}
    </button>
  );
}
