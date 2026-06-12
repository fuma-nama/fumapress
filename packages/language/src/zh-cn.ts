import type { TranslationPreset } from "fumadocs-core/i18n";
import { zhCN as zhCNBase } from "@fumadocs/language/zh-cn";
import type { Translations as AITranslations } from "@fumapress/ai/i18n";
import type { Translations as FeedbackTranslations } from "@fumapress/feedback/i18n";
import type { Translations as FumapressTranslations } from "fumapress/i18n";

const feedback = {
  "How is this guide?(feedback)": "这份指南怎么样？",
  "Good(feedback)": "好",
  "Bad(feedback)": "差",
  "Thank you for your feedback!(feedback)": "感谢你的反馈！",
  "View on GitHub(feedback)": "在 GitHub 上查看",
  "Submit Again(feedback)": "再次提交",
  "Leave your feedback...(feedback)(input placeholder)": "留下你的反馈...",
  "Submit(feedback)": "提交",
  "Feedback(feedback popover)": "反馈",
  "Close(feedback popover)": "关闭",
} satisfies FeedbackTranslations;

const ai = {
  "AI Chat(AI chat)": "AI 对话",
  "AI can be inaccurate, please verify the answers.(AI chat)": "AI 可能不准确，请自行核实答案。",
  "Close(AI chat)(aria-label)": "关闭",
  "Retry(AI chat)": "重试",
  "Clear Chat(AI chat)": "清空对话",
  "AI is answering...(AI chat)(input placeholder)": "AI 正在回答...",
  "Ask a question(AI chat)(input placeholder)": "提出问题",
  "Abort Answer(AI chat)": "中止回答",
  "you(AI chat)(message role)": "你",
  "fumadocs(AI chat)(message role)": "fumadocs",
  "unknown(AI chat)(message role)": "未知",
  "Failed to search(AI chat)": "搜索失败",
  "Searching…(AI chat)": "搜索中…",
  "{count} search results(AI chat)": "{count} 条搜索结果",
  "Start a new chat below.(AI chat)": "在下方开始新对话。",
  "Request Failed: {name}(AI chat)": "请求失败：{name}",
  "Ask AI(AI chat trigger)": "询问 AI",
} satisfies AITranslations;

const fumapress = {
  "Blog(blog)": "博客",
  "All Tags(blog tags page)": "全部标签",
  "{count} tags in total.(blog tags page)": "共 {count} 个标签。",
  'Tag "{tag}"(blog tag page)': '标签 "{tag}"',
  "{count} matching blog posts.(blog tag page)": "{count} 篇相关博客文章。",
  "Back to Home(blog)": "返回首页",
  "Table of Contents(blog panel)": "目录",
  "Share(blog panel)": "分享",
  "Copied(blog panel)": "已复制",
} satisfies FumapressTranslations;

type Keys =
  | (ReturnType<typeof zhCNBase> extends TranslationPreset<infer K> ? K : never)
  | keyof FumapressTranslations
  | keyof FeedbackTranslations
  | keyof AITranslations;

/**
 * Simplified Chinese, including Fumadocs UI, OpenAPI, Story, and Fumapress translations.
 */
export function zhCN(): TranslationPreset<Keys> {
  const base = zhCNBase();
  return {
    name: base.name,
    value: {
      ...base.value,
      ...fumapress,
      ...feedback,
      ...ai,
    },
  };
}
