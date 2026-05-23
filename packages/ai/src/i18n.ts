import type { TranslationsAPIExtension, TranslationValue } from "fumadocs-core/i18n";

export const defaultTranslations = {
  aiChat: "AI Chat",
  aiDisclaimer: "AI can be inaccurate, please verify the answers.",
  close: "Close",
  retry: "Retry",
  clearChat: "Clear Chat",
  aiAnswering: "AI is answering...",
  askQuestion: "Ask a question",
  abortAnswer: "Abort Answer",
  roleUser: "you",
  roleAssistant: "fumadocs",
  unknown: "unknown",
  failedToSearch: "Failed to search",
  searching: "Searching…",
  searchResults: "{count} search results" as TranslationValue<"count">,
  startNewChat: "Start a new chat below.",
  requestFailed: "Request Failed: {name}" as TranslationValue<"name">,
  askAi: "Ask AI",
};

export type Translations = typeof defaultTranslations;

export function aiTranslations(): TranslationsAPIExtension<"ai", Translations> {
  return {
    namespace: "ai",
    defaultValue: defaultTranslations,
  };
}
