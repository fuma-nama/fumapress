import type { TranslationsAPIExtension } from "fumadocs-core/i18n";

export const defaultTranslations = {
  howIsThisGuide: "How is this guide?",
  good: "Good",
  bad: "Bad",
  thankYou: "Thank you for your feedback!",
  viewOnGitHub: "View on GitHub",
  submitAgain: "Submit Again",
  leaveFeedbackPlaceholder: "Leave your feedback...",
  submit: "Submit",
  feedback: "Feedback",
  close: "Close",
};

export type Translations = typeof defaultTranslations;

export function feedbackTranslations(): TranslationsAPIExtension<"feedback", Translations> {
  return {
    namespace: "feedback",
    defaultValue: defaultTranslations,
  };
}
