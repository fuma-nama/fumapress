"use client";

import { useTranslations } from "@fuma-translate/react";

export function BlogTitle() {
  const t = useTranslations();
  return t("Blog", { note: "blog" });
}

export function AllTagsLabel() {
  const t = useTranslations();
  return t("All Tags", { note: "blog tags page" });
}

export function TagsInTotalLabel({ count }: { count: string }) {
  const t = useTranslations();
  return t("{count} tags in total.", { note: "blog tags page", variables: { count } });
}

export function TagTitleLabel({ tag }: { tag: string }) {
  const t = useTranslations();
  return t('Tag "{tag}"', { note: "blog tag page", variables: { tag } });
}

export function MatchingBlogPostsLabel({ count }: { count: string }) {
  const t = useTranslations();
  return t("{count} matching blog posts.", { note: "blog tag page", variables: { count } });
}

export function BackToHomeLabel() {
  const t = useTranslations();
  return t("Back to Home", { note: "blog" });
}
