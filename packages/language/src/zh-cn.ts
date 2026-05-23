import type { TranslationPreset } from "fumadocs-core/i18n";
import { zhCN as zhCNBase } from "@fumadocs/language/zh-cn";
import type { Translations as AITranslations } from "@fumapress/ai/i18n";
import type { Translations as FeedbackTranslations } from "@fumapress/feedback/i18n";
import type { Translations } from "fumapress/i18n";

const feedback = {
  howIsThisGuide: "这份指南怎么样？",
  good: "好",
  bad: "差",
  thankYou: "感谢你的反馈！",
  viewOnGitHub: "在 GitHub 上查看",
  submitAgain: "再次提交",
  leaveFeedbackPlaceholder: "留下你的反馈...",
  submit: "提交",
  feedback: "反馈",
  close: "关闭",
} satisfies FeedbackTranslations;

const ai = {
  aiChat: "AI 对话",
  aiDisclaimer: "AI 可能不准确，请自行核实答案。",
  close: "关闭",
  retry: "重试",
  clearChat: "清空对话",
  aiAnswering: "AI 正在回答...",
  askQuestion: "提出问题",
  abortAnswer: "中止回答",
  roleUser: "你",
  roleAssistant: "fumadocs",
  unknown: "未知",
  failedToSearch: "搜索失败",
  searching: "搜索中…",
  searchResults: "{count} 条搜索结果",
  startNewChat: "在下方开始新对话。",
  requestFailed: "请求失败：{name}",
  askAi: "询问 AI",
} satisfies AITranslations;

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
  ReturnType<typeof zhCNBase>["value"] & {
    fumapress: Translations;
    feedback: FeedbackTranslations;
    ai: AITranslations;
  }
> {
  const base = zhCNBase();
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
