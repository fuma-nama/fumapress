import type { TranslationsAPIExtension, TranslationValue } from "fumadocs-core/i18n";

export const defaultTranslations = {
  blog: "Blog",
  allTags: "All Tags",
  tagsInTotal: "{count} tags in total." as TranslationValue<"count">,
  tagTitle: 'Tag "{tag}"' as TranslationValue<"tag">,
  matchingBlogPosts: "{count} matching blog posts." as TranslationValue<"count">,
  backToHome: "Back to Home",
  tableOfContents: "Table of Contents",
  share: "Share",
  copied: "Copied",
};

export type Translations = typeof defaultTranslations;

export function fumapressTranslations(): TranslationsAPIExtension<"fumapress", Translations> {
  return {
    namespace: "fumapress",
    defaultValue: defaultTranslations,
  };
}
