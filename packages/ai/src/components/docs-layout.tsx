"use client";
import { AIChatPanel, useAIChat } from "@fumadocs/ai-chat";
import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/docs";

/** the Docs Layout of the built-in UI, with the chat of `AIChat` docked */
export function ChatDocsLayout(props: DocsLayoutProps) {
  const { open, setOpen } = useAIChat();

  return <DocsLayout {...props} aiChat={{ open, onOpenChange: setOpen, panel: <AIChatPanel /> }} />;
}
