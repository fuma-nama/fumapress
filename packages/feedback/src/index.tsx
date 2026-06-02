import type { ConfigContext, ServerPlugin } from "fumapress";
import type { ActionResponse, BlockFeedback, PageFeedback } from "./components/feedback/schema";
import type { DocsLayoutContextData } from "fumapress/layouts/docs";

export interface FeedbackPluginOptions {
  onPageFeedbackAction?: (feedback: PageFeedback) => Promise<ActionResponse>;
  onTextFeedbackAction?: (feedback: BlockFeedback) => Promise<ActionResponse>;
}

export function feedbackPlugin<C extends ConfigContext = ConfigContext>(
  options: FeedbackPluginOptions,
): ServerPlugin<C> {
  const { onPageFeedbackAction, onTextFeedbackAction } = options;

  function initRenderers(ctxData: DocsLayoutContextData) {
    const renderers = (ctxData.renderers ??= []);
    renderers.push(async (data) => {
      if (onTextFeedbackAction) {
        const { FeedbackText } = await import("./components/feedback/client");

        data.body = <FeedbackText onSendAction={onTextFeedbackAction}>{data.body}</FeedbackText>;
      }

      if (onPageFeedbackAction) {
        const { Feedback } = await import("./components/feedback/client");

        data.pageProps.children ??= [];
        data.pageProps.children.push((children) => (
          <>
            {children}
            <Feedback onSendAction={onPageFeedbackAction} />
          </>
        ));
      }

      return data;
    });
  }
  return {
    name: "feedback:main",
    async init() {
      if (this.translationsConfig) {
        const { feedbackTranslations } = await import("./i18n");
        // ensure language pack works correctly without calling `extend()`
        this.translationsConfig.extend(feedbackTranslations());
      }

      initRenderers((this.data["core:docs-layout"] ??= {}));
      initRenderers((this.data["core:notebook-layout"] ??= {}) as never);
    },
  };
}
