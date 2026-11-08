import type { ApiRoute, AppShape, Awaitable, Context, Plugin, SlotItem } from "@fumapress/core";
import type { ZodMiniType } from "zod/mini";
import {
  blockFeedback,
  pageFeedback,
  type ActionResponse,
  type BlockFeedback,
  type PageFeedback,
} from "./components/feedback/schema";
import { feedbackTranslations } from "./i18n";

const pageApi = "/api/feedback/page";
const textApi = "/api/feedback/text";

export interface FeedbackPluginOptions {
  /**
   * handles page feedback: a client function (`'use client'`) in the browser, other functions on the server at
   * `/api/feedback/page`, where a thrown `Response` is the answer
   */
  onPageFeedbackAction?: (feedback: PageFeedback) => Promise<ActionResponse>;
  /** handles text feedback, like `onPageFeedbackAction` at `/api/feedback/text` */
  onTextFeedbackAction?: (feedback: BlockFeedback) => Promise<ActionResponse>;
  /**
   * invoked before handling feedback requests on the server, you can use it for ratelimit and other validations.
   */
  beforeRequest?: (request: Request) => Awaitable<Response | undefined>;
}

/** `feedback:page` in `footer`, `props.slots["feedback:page"]` in `ui.renderPage`, and `feedback:text` around the content */
export type FeedbackTypes = { slots: "feedback:page" | "feedback:text" };

/** feedback on pages (`feedback:page` after the content) and on text selections (`feedback:text` around the content) */
export function feedbackPlugin<C extends AppShape = AppShape>(
  options: FeedbackPluginOptions,
): Plugin<C, FeedbackTypes> {
  const { onPageFeedbackAction, onTextFeedbackAction, beforeRequest } = options;

  function route<T>(
    ctx: Context<C>,
    path: string,
    schema: ZodMiniType<T>,
    action: ((feedback: T) => Promise<ActionResponse>) | undefined,
  ): ApiRoute | undefined {
    if (!action || ctx.isClientReference(action)) return;
    return {
      path,
      async POST(request) {
        const response = await beforeRequest?.(request);
        if (response) return response;

        const parsed = schema.safeParse(await request.json().catch(() => undefined));
        if (!parsed.success) return new Response("invalid body type", { status: 400 });
        try {
          return Response.json(await action(parsed.data));
        } catch (error) {
          if (error instanceof Response) return error;
          throw error;
        }
      },
    };
  }

  /** the action of the UI: the client function itself, or the URL of its route */
  function uiAction<T extends object>(ctx: Context<C>, path: string, action: T): T | string {
    return ctx.isClientReference(action) ? action : ctx.withBase(path);
  }

  return {
    name: "feedback:main",
    translations: feedbackTranslations(),
    routes({ createApi }) {
      for (const item of [
        route(this, pageApi, pageFeedback, onPageFeedbackAction),
        route(this, textApi, blockFeedback, onTextFeedbackAction),
      ]) {
        if (item) createApi(item);
      }
    },
    async slots({ page }) {
      if (!page) return;
      const { Feedback, FeedbackText } = await import("./components/feedback/client");
      const items: SlotItem<FeedbackTypes>[] = [];
      if (onTextFeedbackAction)
        items.push({
          name: "feedback:text",
          region: "body-wrapper",
          component: FeedbackText,
          props: { action: uiAction(this, textApi, onTextFeedbackAction) },
        });
      if (onPageFeedbackAction)
        items.push({
          name: "feedback:page",
          region: "footer",
          component: Feedback,
          props: { action: uiAction(this, pageApi, onPageFeedbackAction) },
        });
      return items;
    },
  };
}
