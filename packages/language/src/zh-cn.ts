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
  "Ask AI(AI chat)": "询问 AI",
  "What do you want to know?(AI chat)": "你想了解什么？",
  "Answers come from the docs, AI can make mistakes.(AI chat)": "回答来自文档，AI 可能会出错。",
  "Suggestions(AI chat)(aria-label)": "建议",
  "Summarize this page(AI chat)": "总结此页面",
  "How do I get started?(AI chat)": "我该如何开始？",
  "What can I customize?(AI chat)": "我可以自定义哪些内容？",
  "Message(AI chat)(aria-label)": "消息",
  "Ask a question(AI chat)": "提出问题",
  "Ask a follow-up(AI chat)": "继续提问",
  "Send(AI chat)(aria-label)": "发送",
  "Stop(AI chat)(aria-label)": "停止",
  "New chat(AI chat)": "新对话",
  "Close(AI chat)": "关闭",
  "Copy(AI chat)": "复制",
  "Copied(AI chat)": "已复制",
  "Retry(AI chat)": "重试",
  "Scroll to latest(AI chat)(aria-label)": "滚动到最新",
  "Thinking(AI chat)": "思考中",
  "Searching(AI chat)": "搜索中",
  "Searched(AI chat)": "已搜索",
  "Search stopped(AI chat)": "搜索已停止",
  "Search failed(AI chat)": "搜索失败",
  "1 result(AI chat)": "1 条结果",
  "{count} results(AI chat)": "{count} 条结果",
  "Sources(AI chat)(aria-label)": "来源",
  "Something went wrong.(AI chat)": "出了点问题。",
  "Try again(AI chat)": "再试一次",
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
  "Newer post(blog post navigation)": "较新文章",
  "Older post(blog post navigation)": "较旧文章",
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
