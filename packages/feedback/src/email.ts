import { blockFeedback, pageFeedback } from "@/components/feedback/schema";
import type { AppShape, PressPlugin, PressPluginOption } from "fumapress";
import { feedbackPlugin } from ".";
import { onPageFeedbackAction, onTextFeedbackAction } from "./email.client";

export interface EmailFeedbackPluginOptions {
  /**
   * Resend API key ([Resend Dashboard](https://resend.com/api-keys)).
   * Keep this secret; only reference it from server-side config or env vars.
   */
  apiKey: string;
  from: string;
  to: string | string[];
  /** Prepended to every outgoing subject line */
  subjectPrefix?: string;
  /**
   * invoked before handling feedback requests, you can use it for ratelimit and other validations.
   */
  beforeRequest?: (request: Request) => Response | undefined | Promise<Response | undefined>;
}

async function sendResendEmail(opts: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
}): Promise<Response> {
  const resend = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    }),
  });

  if (!resend.ok) {
    return new Response(await resend.text(), { status: resend.status });
  }

  return Response.json({ emailSent: true });
}

export function emailFeedbackPlugin<C extends AppShape = AppShape>(
  options: EmailFeedbackPluginOptions,
): PressPluginOption<C> {
  const { apiKey, from, beforeRequest } = options;
  const to = Array.isArray(options.to) ? options.to : [options.to];
  const subjectPrefix = options.subjectPrefix ?? "[Docs feedback]";

  const base = feedbackPlugin<C>({
    onPageFeedbackAction,
    onTextFeedbackAction,
  });

  const additional: PressPlugin<C> = {
    name: "feedback:email",
    createPages({ createApi }) {
      if (this.mode === "static")
        throw new Error(
          "[@fumapress/feedback] Email integration is not compatible with static mode",
        );

      createApi({
        render: "dynamic",
        path: "/api/feedback/page",
        handlers: {
          POST: async (req) => {
            if (beforeRequest) {
              const res = await beforeRequest(req);
              if (res) return res;
            }

            const parsed = pageFeedback.safeParse(await req.json());
            if (!parsed.success) return new Response("invalid body type", { status: 400 });
            const feedback = parsed.data;
            const url = new URL(feedback.url);

            const body = `[${feedback.opinion}] ${feedback.message}\n\n> Forwarded from user feedback.\n\nPage: ${feedback.url}\nPath: ${url.pathname}`;

            return sendResendEmail({
              apiKey,
              from,
              to,
              subject: `${subjectPrefix} ${url.pathname}`,
              text: body,
            });
          },
        },
      });

      createApi({
        render: "dynamic",
        path: "/api/feedback/text",
        handlers: {
          POST: async (req) => {
            if (beforeRequest) {
              const res = await beforeRequest(req);
              if (res) return res;
            }

            const parsed = blockFeedback.safeParse(await req.json());
            if (!parsed.success) return new Response("invalid body type", { status: 400 });
            const feedback = parsed.data;
            const url = new URL(feedback.url);
            url.hash = feedback.blockId;

            const body =
              `${feedback.message}\n\n` +
              `Quoted selection:\n> ${feedback.blockBody.replace(/\n/g, "\n> ")}\n\n` +
              `> [Forwarded from user feedback](${url.href}).`;

            return sendResendEmail({
              apiKey,
              from,
              to,
              subject: `${subjectPrefix} text on ${url.pathname}`,
              text: body,
            });
          },
        },
      });
    },
  };

  return [base, additional];
}
