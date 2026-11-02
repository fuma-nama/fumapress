import type { AppShape, PressPlugin } from "fumapress";
import type { ActionResponse, BlockFeedback, PageFeedback } from "./components/feedback/schema";

export interface FeedbackPluginOptions {
  onPageFeedbackAction?: (feedback: PageFeedback) => Promise<ActionResponse>;
  onTextFeedbackAction?: (feedback: BlockFeedback) => Promise<ActionResponse>;
}

export function feedbackPlugin<C extends AppShape = AppShape>(
  options: FeedbackPluginOptions,
): PressPlugin<C> {
  const { onPageFeedbackAction, onTextFeedbackAction } = options;

  return {
    name: "feedback:main",
    async init() {
      if (this.translationsConfig) {
        const { feedbackTranslations } = await import("./i18n");
        // ensure language pack works correctly without calling `extend()`
        this.translationsConfig.extend(feedbackTranslations());
      }
    },
    async slots() {
      const { Feedback, FeedbackText } = await import("./components/feedback/client");
      const items = [];
      if (onTextFeedbackAction)
        items.push({
          slot: "body.wrapper" as const,
          component: FeedbackText,
          props: { onSendAction: onTextFeedbackAction },
        });
      if (onPageFeedbackAction)
        items.push({
          slot: "page.footer" as const,
          component: Feedback,
          props: { onSendAction: onPageFeedbackAction },
        });
      return items;
    },
  };
}
