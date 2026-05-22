import type { TranslationPreset } from "fumadocs-core/i18n";
import { zhCN as zhCNBase } from "@fumadocs/language/zh-cn";
import type { Translations } from "fumapress/i18n";

const fumapress = {
  blog: "博客",
  allTags: "全部标签",
  tagsInTotal: "共 {count} 个标签。",
  tagTitle: '标签 "{tag}"',
  matchingBlogPosts: "{count} 篇相关博客文章。",
  backToHome: "返回首页",
  tableOfContents: "目录",
  share: "分享",
  copied: "已复制",
} satisfies Translations;

/**
 * Simplified Chinese, including Fumadocs UI, OpenAPI, Story, and Fumapress translations.
 */
export function zhCN(): TranslationPreset<
  ReturnType<typeof zhCNBase>["value"] & { fumapress: Translations }
> {
  const base = zhCNBase();
  return {
    name: base.name,
    value: {
      ...base.value,
      fumapress,
    },
  };
}
