import type { TranslationPreset } from "fumadocs-core/i18n";
import { zhTW as zhTWBase } from "@fumadocs/language/zh-tw";
import type { Translations as AITranslations } from "@fumapress/ai/i18n";
import type { Translations as FeedbackTranslations } from "@fumapress/feedback/i18n";
import type { Translations as FumapressTranslations } from "fumapress/i18n";

const feedback = {
  "How is this guide?(feedback)": "這份指南怎麼樣？",
  "Good(feedback)": "好",
  "Bad(feedback)": "差",
  "Thank you for your feedback!(feedback)": "感謝你的回饋！",
  "View on GitHub(feedback)": "在 GitHub 上查看",
  "Submit Again(feedback)": "再次提交",
  "Leave your feedback...(feedback)(input placeholder)": "留下你的回饋...",
  "Submit(feedback)": "提交",
  "Feedback(feedback popover)": "回饋",
  "Close(feedback popover)": "關閉",
} satisfies FeedbackTranslations;

const ai = {
  "Ask AI(AI chat)": "詢問 AI",
  "What do you want to know?(AI chat)": "你想知道什麼？",
  "Answers come from the docs, AI can make mistakes.(AI chat)": "回答來自文件，AI 可能會出錯。",
  "Suggestions(AI chat)(aria-label)": "建議",
  "Summarize this page(AI chat)": "總結這個頁面",
  "How do I get started?(AI chat)": "我該如何開始？",
  "What can I customize?(AI chat)": "我可以自訂哪些內容？",
  "Message(AI chat)(aria-label)": "訊息",
  "Ask a question(AI chat)": "提出問題",
  "Ask a follow-up(AI chat)": "繼續提問",
  "Send(AI chat)(aria-label)": "傳送",
  "Stop(AI chat)(aria-label)": "停止",
  "New chat(AI chat)": "新對話",
  "Close(AI chat)": "關閉",
  "Copy(AI chat)": "複製",
  "Copied(AI chat)": "已複製",
  "Retry(AI chat)": "重試",
  "Scroll to latest(AI chat)(aria-label)": "捲動到最新",
  "Thinking(AI chat)": "思考中",
  "Searching(AI chat)": "搜尋中",
  "Searched(AI chat)": "已搜尋",
  "Search stopped(AI chat)": "搜尋已停止",
  "Search failed(AI chat)": "搜尋失敗",
  "1 result(AI chat)": "1 條結果",
  "{count} results(AI chat)": "{count} 條結果",
  "Sources(AI chat)(aria-label)": "來源",
  "Something went wrong.(AI chat)": "發生錯誤。",
  "Try again(AI chat)": "再試一次",
} satisfies AITranslations;

const fumapress = {
  "Blog(blog)": "部落格",
  "All Tags(blog tags page)": "全部標籤",
  "{count} tags in total.(blog tags page)": "共 {count} 個標籤。",
  'Tag "{tag}"(blog tag page)': '標籤 "{tag}"',
  "{count} matching blog posts.(blog tag page)": "{count} 篇相關部落格文章。",
  "Back to Home(blog)": "返回首頁",
  "Table of Contents(blog panel)": "目錄",
  "Share(blog panel)": "分享",
  "Copied(blog panel)": "已複製",
  "Newer post(blog post navigation)": "較新文章",
  "Older post(blog post navigation)": "較舊文章",
} satisfies FumapressTranslations;

type Keys =
  | (ReturnType<typeof zhTWBase> extends TranslationPreset<infer K> ? K : never)
  | keyof FumapressTranslations
  | keyof FeedbackTranslations
  | keyof AITranslations;

/**
 * Traditional Chinese, including Fumadocs UI, OpenAPI, Story, and Fumapress translations.
 */
export function zhTW(): TranslationPreset<Keys> {
  const base = zhTWBase();
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
