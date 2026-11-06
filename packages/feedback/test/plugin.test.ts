import { describe, expect, it, vi } from "vitest";
import {
  createPress,
  type ApiRoute,
  type AppShape,
  type Context,
  type Plugin,
} from "@fumapress/core";
import { createPressContext } from "@fumapress/core/runtime";
import { feedbackPlugin } from "../src/index";
import { emailFeedbackPlugin } from "../src/email";
import { githubFeedbackPlugin } from "../src/github";
import { Feedback, FeedbackText } from "../src/components/feedback/client";

const octokit = vi.hoisted(() => ({ getInstallationOctokit: vi.fn() }));
vi.mock("octokit", () => ({
  Octokit: class {},
  App: class {
    octokit = { request: async () => ({ data: { id: 1 } }) };
    getInstallationOctokit = octokit.getInstallationOctokit;
  },
}));

const repository = { id: "repo", discussionCategories: { nodes: [{ id: "cat", name: "Docs" }] } };
const discussion = { id: "thread", title: "Feedback for /docs", url: "https://github.com/thread" };

const action = async () => ({});
/** a function exported from a `'use client'` module, as the runtime reports it */
const clientAction = async () => ({});
const ctx = {
  withBase: (path: string) => `/docs${path}`,
  isClientReference: (value: unknown) => value === clientAction,
} as unknown as Context;

async function apiRoutes(plugin: ReturnType<typeof feedbackPlugin>) {
  const routes: ApiRoute[] = [];
  await plugin.routes!.call(ctx, { createApi: (route) => routes.push(route), createView() {} });
  return routes;
}

/** the API routes of a real static site */
async function staticRoutes(plugin: Plugin<AppShape, any>) {
  const site = await createPressContext(
    createPress({ files: [] }).plugins(plugin).config({ preset: [] }),
    {
      base: "/",
      defaults: [],
      signal: new AbortController().signal,
      isClientReference: ctx.isClientReference,
    },
  );
  site.setRuntimeRoutes([]);
  return site.getApiRoutes();
}

describe("feedbackPlugin", () => {
  it("serves server actions as API routes", async () => {
    const plugin = feedbackPlugin({ onPageFeedbackAction: action, onTextFeedbackAction: action });
    expect(await apiRoutes(plugin)).toEqual([
      { path: "/api/feedback/page", POST: expect.any(Function) },
      { path: "/api/feedback/text", POST: expect.any(Function) },
    ]);
  });

  it("runs client actions in the browser", async () => {
    const plugin = feedbackPlugin({ onPageFeedbackAction: clientAction });
    expect(await staticRoutes(plugin)).toEqual([]);
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

  it.each([
    ["a missing field", { url: "http://localhost/docs", opinion: "good" }],
    ["a bad URL", { url: "/docs", opinion: "good", message: "" }],
  ])("answers 400 to %s", async (_, body) => {
    const [route] = await apiRoutes(feedbackPlugin({ onPageFeedbackAction: action }));
    const request = new Request("http://localhost/api/feedback/page", {
      method: "POST",
      body: JSON.stringify(body),
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
    const [route] = await apiRoutes(plugin);
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

  it("finds the discussion of a page in the storage repository", async () => {
    const graphql = vi.fn(async (query: string) => {
      if (query.includes("repository(")) return { repository };
      if (query.includes("search(")) return { search: { nodes: [discussion] } };
      return { addDiscussionComment: { comment: { url: "https://github.com/comment" } } };
    });
    octokit.getInstallationOctokit.mockResolvedValue({ graphql });
    const [route] = await apiRoutes(
      githubFeedbackPlugin({
        appId: "1",
        privateKey: "key",
        storage: { owner: "acme", repo: "docs", category: "Docs" },
      }),
    );

    const response = await route!.POST!(
      new Request("http://localhost/api/feedback/page", {
        method: "POST",
        body: JSON.stringify({ url: "http://localhost/docs", opinion: "good", message: "" }),
      }),
      { params: {} },
    );

    expect(graphql.mock.calls[1]?.[0]).toContain(
      String.raw`\"Feedback for /docs\" in:title repo:acme/docs author:@me`,
    );
    expect(await response.json()).toEqual({ githubUrl: "https://github.com/comment" });
  });
});
