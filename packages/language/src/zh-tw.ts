import type { TranslationPreset } from "fumadocs-core/i18n";
import { zhTW as zhTWBase } from "@fumadocs/language/zh-tw";
import type { Translations as AITranslations } from "@fumapress/ai/i18n";
import type { Translations as FeedbackTranslations } from "@fumapress/feedback/i18n";
import type { Translations } from "fumapress/i18n";

const feedback = {
  howIsThisGuide: "這份指南怎麼樣？",
  good: "好",
  bad: "差",
  thankYou: "感謝你的回饋！",
  viewOnGitHub: "在 GitHub 上查看",
  submitAgain: "再次提交",
  leaveFeedbackPlaceholder: "留下你的回饋...",
  submit: "提交",
  feedback: "回饋",
  close: "關閉",
} satisfies FeedbackTranslations;

const ai = {
  aiChat: "AI 對話",
  aiDisclaimer: "AI 可能不準確，請自行核實答案。",
  close: "關閉",
  retry: "重試",
  clearChat: "清空對話",
  aiAnswering: "AI 正在回答...",
  askQuestion: "提出問題",
  abortAnswer: "中止回答",
  roleUser: "你",
  roleAssistant: "fumadocs",
  unknown: "未知",
  failedToSearch: "搜尋失敗",
  searching: "搜尋中…",
  searchResults: "{count} 條搜尋結果",
  startNewChat: "在下方開始新對話。",
  requestFailed: "請求失敗：{name}",
  askAi: "詢問 AI",
} satisfies AITranslations;

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
  ReturnType<typeof zhTWBase>["value"] & {
    fumapress: Translations;
    feedback: FeedbackTranslations;
    ai: AITranslations;
  }
> {
  const base = zhTWBase();
  return {
    name: base.name,
    value: {
      ...base.value,
      fumapress,
      feedback,
      ai,
    },
  };
}
