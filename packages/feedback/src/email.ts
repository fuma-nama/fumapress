import type { AppShape, Plugin } from "@fumapress/core";
import type { ActionResponse } from "@/components/feedback/schema";
import { feedbackPlugin, type FeedbackPluginOptions, type FeedbackTypes } from ".";

export interface EmailFeedbackPluginOptions extends Pick<FeedbackPluginOptions, "beforeRequest"> {
  /**
   * Resend API key ([Resend Dashboard](https://resend.com/api-keys)).
   * Keep this secret; only reference it from server-side config or env vars.
   */
  apiKey: string;
  from: string;
  to: string | string[];
  /** Prepended to every outgoing subject line */
  subjectPrefix?: string;
}

async function sendResendEmail(opts: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
}): Promise<ActionResponse> {
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

  // the client gets Resend's status and reason
  if (!resend.ok) throw new Response(await resend.text(), { status: resend.status });
  return { emailSent: true };
}

export function emailFeedbackPlugin<C extends AppShape = AppShape>(
  options: EmailFeedbackPluginOptions,
): Plugin<C, FeedbackTypes> {
  const { apiKey, from } = options;
  const to = Array.isArray(options.to) ? options.to : [options.to];
  const subjectPrefix = options.subjectPrefix ?? "[Docs feedback]";

  return feedbackPlugin<C>({
    beforeRequest: options.beforeRequest,
    async onPageFeedbackAction(feedback) {
      const url = new URL(feedback.url);

      return sendResendEmail({
        apiKey,
        from,
        to,
        subject: `${subjectPrefix} ${url.pathname}`,
        text: `[${feedback.opinion}] ${feedback.message}\n\n> Forwarded from user feedback.\n\nPage: ${feedback.url}\nPath: ${url.pathname}`,
      });
    },
    async onTextFeedbackAction(feedback) {
      const url = new URL(feedback.url);
      url.hash = feedback.blockId;

      return sendResendEmail({
        apiKey,
        from,
        to,
        subject: `${subjectPrefix} text on ${url.pathname}`,
        text:
          `${feedback.message}\n\n` +
          `Quoted selection:\n> ${feedback.blockBody.replace(/\n/g, "\n> ")}\n\n` +
          `> [Forwarded from user feedback](${url.href}).`,
      });
    },
  });
}
