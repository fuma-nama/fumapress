import type { AppShape, PressPlugin } from "fumapress";
import type { ActionResponse, BlockFeedback, PageFeedback } from "./components/feedback/schema";
import type { DocsLayoutContextData } from "fumapress/layouts/docs";

export interface FeedbackPluginOptions {
  onPageFeedbackAction?: (feedback: PageFeedback) => Promise<ActionResponse>;
  onTextFeedbackAction?: (feedback: BlockFeedback) => Promise<ActionResponse>;
}

export function feedbackPlugin<C extends AppShape = AppShape>(
  options: FeedbackPluginOptions,
): PressPlugin<C> {
  const { onPageFeedbackAction, onTextFeedbackAction } = options;

  async function initUI(ctxData: DocsLayoutContextData<C>) {
    if (onTextFeedbackAction) {
      const { FeedbackText } = await import("./components/feedback/client");
      const transformers = (ctxData.transformers ??= []);
      transformers.push(({ data }) => {
        data.body = <FeedbackText onSendAction={onTextFeedbackAction}>{data.body}</FeedbackText>;
        return data;
      });
    }

    if (onPageFeedbackAction) {
      const { Feedback } = await import("./components/feedback/client");
      const interceptors = (ctxData.pageInterceptors ??= []);
      interceptors.push(function ({ props, next }) {
        return next({
          ...props,
          children: (
            <>
              {props.children}
              <Feedback onSendAction={onPageFeedbackAction} />
            </>
          ),
        });
      });
    }
  }

  return {
    name: "feedback:main",
    async init() {
      if (this.translationsConfig) {
        const { feedbackTranslations } = await import("./i18n");
        // ensure language pack works correctly without calling `extend()`
        this.translationsConfig.extend(feedbackTranslations());
      }

      await initUI((this.data["core:docs-layout"] ??= {}));
      await initUI((this.data["core:notebook-layout"] ??= {}) as DocsLayoutContextData<C>);
    },
  };
}
