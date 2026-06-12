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
  "AI Chat(AI chat)": "AI 對話",
  "AI can be inaccurate, please verify the answers.(AI chat)": "AI 可能不準確，請自行核實答案。",
  "Close(AI chat)(aria-label)": "關閉",
  "Retry(AI chat)": "重試",
  "Clear Chat(AI chat)": "清空對話",
  "AI is answering...(AI chat)(input placeholder)": "AI 正在回答...",
  "Ask a question(AI chat)(input placeholder)": "提出問題",
  "Abort Answer(AI chat)": "中止回答",
  "you(AI chat)(message role)": "你",
  "fumadocs(AI chat)(message role)": "fumadocs",
  "unknown(AI chat)(message role)": "未知",
  "Failed to search(AI chat)": "搜尋失敗",
  "Searching…(AI chat)": "搜尋中…",
  "{count} search results(AI chat)": "{count} 條搜尋結果",
  "Start a new chat below.(AI chat)": "在下方開始新對話。",
  "Request Failed: {name}(AI chat)": "請求失敗：{name}",
  "Ask AI(AI chat trigger)": "詢問 AI",
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
