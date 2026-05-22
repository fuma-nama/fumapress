import type { TranslationPreset } from "fumadocs-core/i18n";
import { zhTW as zhTWBase } from "@fumadocs/language/zh-tw";
import type { Translations } from "fumapress/i18n";

const fumapress = {
  blog: "部落格",
  allTags: "全部標籤",
  tagsInTotal: "共 {count} 個標籤。",
  tagTitle: '標籤 "{tag}"',
  matchingBlogPosts: "{count} 篇相關部落格文章。",
  backToHome: "返回首頁",
  tableOfContents: "目錄",
  share: "分享",
  copied: "已複製",
} satisfies Translations;

/**
 * Traditional Chinese, including Fumadocs UI, OpenAPI, Story, and Fumapress translations.
 */
export function zhTW(): TranslationPreset<
  ReturnType<typeof zhTWBase>["value"] & { fumapress: Translations }
> {
  const base = zhTWBase();
  return {
    name: base.name,
    value: {
      ...base.value,
      fumapress,
    },
  };
}
