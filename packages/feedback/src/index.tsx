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

        data.layoutProps.children ??= [];
        data.layoutProps.children.push((children) => (
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
    async init() {
      initRenderers((this.data["core:docs-layout"] ??= {}));
      initRenderers((this.data["core:notebook-layout"] ??= {}) as never);
    },
  };
}
