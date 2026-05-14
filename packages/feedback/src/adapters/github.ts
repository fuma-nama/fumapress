import { App, Octokit } from "octokit";
import { blockFeedback, pageFeedback } from "@/components/feedback/schema";
import type { ConfigContext, ServerPlugin } from "fumapress";
import { feedbackPlugin } from "..";
import { onPageFeedbackAction, onTextFeedbackAction } from "./github.client";

export interface GitHubFeedbackPluginOptions {
  /** info for the repository to store feedbacks */
  storage: {
    owner: string;
    repo: string;
    /** discussion category */
    category: string;
  };

  appId: string;
  privateKey: string;
  /**
   * invoked before handling feedback requests, you can use it for ratelimit and other validations.
   */
  beforeRequest?: (request: Request) => Response | undefined | Promise<Response | undefined>;
}

interface RepositoryInfo {
  id: string;
  discussionCategories: {
    nodes: {
      id: string;
      name: string;
    }[];
  };
}

export function githubFeedbackPlugin<C extends ConfigContext = ConfigContext>(
  options: GitHubFeedbackPluginOptions,
): ServerPlugin<C> {
  const { beforeRequest } = options;
  const { owner, repo, category: FeedbackCategory } = options.storage;
  let instance: Promise<Octokit> | undefined;

  async function getOctokit(): Promise<Octokit> {
    return (instance ??= createOctokit());
  }

  async function createOctokit(): Promise<Octokit> {
    const app = new App({
      appId: options.appId,
      privateKey: options.privateKey,
    });

    const { data } = await app.octokit.request("GET /repos/{owner}/{repo}/installation", {
      owner,
      repo,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    return await app.getInstallationOctokit(data.id);
  }

  let cachedDestination: RepositoryInfo | undefined;
  async function getFeedbackRepository() {
    if (cachedDestination) return cachedDestination;
    const octokit = await getOctokit();

    const {
      repository,
    }: {
      repository: RepositoryInfo;
    } = await octokit.graphql(`
      query {
        repository(owner: "${owner}", name: "${repo}") {
          id
          discussionCategories(first: 25) {
            nodes { id name }
          }
        }
      }
    `);

    return (cachedDestination = repository);
  }

  async function createDiscussionThread(pageId: string, body: string): Promise<Response> {
    const octokit = await getOctokit();
    const repo = await getFeedbackRepository();
    const category = repo.discussionCategories.nodes.find(
      (category) => category.name === FeedbackCategory,
    );

    if (!category) {
      return new Response(`Please create a "${FeedbackCategory}" category in GitHub Discussion`, {
        status: 500,
      });
    }

    const title = `Feedback for ${pageId}`;
    const queryResult: {
      search: {
        nodes: { id: string; title: string; url: string }[];
      };
    } = await octokit.graphql(`
              query {
                search(type: DISCUSSION, query: ${JSON.stringify(`"${title}" in:title repo:${owner}/${repo} author:@me`)}, first: 10) {
                  nodes {
                    ... on Discussion { id, title, url }
                  }
                }
              }`);

    const discussion = queryResult.search.nodes.find((item) => item.title === title);

    if (discussion) {
      const result: {
        addDiscussionComment: {
          comment: { id: string; url: string };
        };
      } = await octokit.graphql(`
                mutation {
                  addDiscussionComment(input: { body: ${JSON.stringify(body)}, discussionId: "${discussion.id}" }) {
                    comment { id, url }
                  }
                }`);

      return Response.json({
        githubUrl: result.addDiscussionComment.comment.url,
      });
    } else {
      const result: {
        createDiscussion: {
          discussion: { id: string; url: string };
        };
      } = await octokit.graphql(`
                mutation {
                  createDiscussion(input: { repositoryId: "${repo.id}", categoryId: "${category.id}", body: ${JSON.stringify(body)}, title: ${JSON.stringify(title)} }) {
                    discussion { id, url }
                  }
                }`);

      return Response.json({
        githubUrl: result.createDiscussion.discussion.url,
      });
    }
  }

  const base = feedbackPlugin<C>({
    onPageFeedbackAction,
    onTextFeedbackAction,
  });

  return {
    ...base,
    createPages(fns) {
      const { createApi } = fns;

      if (this.mode === "static")
        throw new Error(
          "[@fumapress/feedback] GitHub integration is not compatiable with static mode",
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

            return createDiscussionThread(
              url.pathname,
              `[${feedback.opinion}] ${feedback.message}\n\n> Forwarded from user feedback.`,
            );
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

            return createDiscussionThread(
              url.pathname,
              `> ${feedback.blockBody}\n\n${feedback.message}\n\n> [Forwarded from user feedback](${url.href}).`,
            );
          },
        },
      });

      return base.createPages?.call(this, fns);
    },
  };
}
