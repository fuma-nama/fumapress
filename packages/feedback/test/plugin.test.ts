import { describe, expect, it, vi } from "vitest";
import type { Context } from "@fumapress/core";
import { feedbackPlugin } from "../src/index";
import { emailFeedbackPlugin } from "../src/email";
import { Feedback, FeedbackText } from "../src/components/feedback/client";

const action = async () => ({});
/** a function exported from a `'use client'` module, as the runtime reports it */
const clientAction = async () => ({});
const ctx = {
  mode: "default",
  withBase: (path: string) => `/docs${path}`,
  isClientReference: (value: unknown) => value === clientAction,
} as unknown as Context;

describe("feedbackPlugin", () => {
  it("serves server actions as API routes", async () => {
    const plugin = feedbackPlugin({ onPageFeedbackAction: action, onTextFeedbackAction: action });
    expect(await plugin.apiRoutes!.call(ctx)).toEqual([
      { path: "/api/feedback/page", render: "dynamic", POST: expect.any(Function) },
      { path: "/api/feedback/text", render: "dynamic", POST: expect.any(Function) },
    ]);
    expect(() => plugin.apiRoutes!.call({ ...ctx, mode: "static" })).toThrow(/static mode/);
  });

  it("runs client actions in the browser", async () => {
    const plugin = feedbackPlugin({ onPageFeedbackAction: clientAction });
    expect(await plugin.apiRoutes!.call({ ...ctx, mode: "static" })).toEqual([]);
    expect(await plugin.slots!.call(ctx, { page: {} as never })).toEqual([
      {
        slot: "footer",
        name: "feedback",
        component: Feedback,
        props: { action: clientAction },
      },
    ]);
  });

  it("adds the `feedback` footer and the text feedback of pages", async () => {
    const plugin = feedbackPlugin({ onPageFeedbackAction: action, onTextFeedbackAction: action });
    expect(await plugin.slots!.call(ctx, {})).toBeUndefined();
    expect(await plugin.slots!.call(ctx, { page: {} as never })).toEqual([
      {
        slot: "body.wrapper",
        component: FeedbackText,
        props: { action: "/docs/api/feedback/text" },
      },
      {
        slot: "footer",
        name: "feedback",
        component: Feedback,
        props: { action: "/docs/api/feedback/page" },
      },
    ]);
  });

  it("validates request bodies", async () => {
    const [route] = (await feedbackPlugin({ onPageFeedbackAction: action }).apiRoutes!.call(ctx))!;
    const request = new Request("http://localhost/api/feedback/page", {
      method: "POST",
      body: JSON.stringify({ url: "/" }),
    });
    expect((await route!.POST!(request, { params: {} })).status).toBe(400);
  });

  it("answers with the response an action throws, like the error of Resend", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("The domain is not verified", { status: 403 }));
    const plugin = emailFeedbackPlugin({
      apiKey: "key",
      from: "a@example.com",
      to: "b@example.com",
    });
    const [route] = (await plugin.apiRoutes!.call(ctx))!;
    const response = await route!.POST!(
      new Request("http://localhost/api/feedback/page", {
        method: "POST",
        body: JSON.stringify({ url: "http://localhost/docs", opinion: "good", message: "" }),
      }),
      { params: {} },
    );

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe("The domain is not verified");
    fetch.mockRestore();
  });
});
