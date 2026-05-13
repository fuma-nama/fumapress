import type { ConfigContext, ServerPlugin } from "fumapress";
import { FeedbackText } from "./components/feedback/client";
import type { ActionResponse, BlockFeedback, PageFeedback } from "./components/feedback/schema";

export interface PluginOptions {
  onPageFeedbackAction: (feedback: PageFeedback) => Promise<ActionResponse>;
  onTextFeedbackAction: (feedback: BlockFeedback) => Promise<ActionResponse>;
}

export function feedbackPlugin<C extends ConfigContext = ConfigContext>(
  options: PluginOptions,
): ServerPlugin<C> {
  return {
    init() {
      this.data["core:docs-layout"] ??= {};
      const renderers = (this.data["core:docs-layout"].renderers ??= []);
      renderers.push((data) => {
        data.body = (
          <FeedbackText onSendAction={options.onTextFeedbackAction}>{data.body}</FeedbackText>
        );
        return data;
      });
    },
  };
}
