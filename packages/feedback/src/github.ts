import { App, Octokit } from "octokit";
import type { AppShape, Plugin } from "@fumapress/core";
import type { ActionResponse } from "@/components/feedback/schema";
import { feedbackPlugin, type FeedbackPluginOptions, type FeedbackTypes } from ".";

export interface GitHubFeedbackPluginOptions extends Pick<FeedbackPluginOptions, "beforeRequest"> {
  /** info for the repository to store feedbacks */
  storage: {
    owner: string;
    repo: string;
    /** discussion category */
    category: string;
  };

  appId: string;
  privateKey: string;
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

export function githubFeedbackPlugin<C extends AppShape = AppShape>(
  options: GitHubFeedbackPluginOptions,
): Plugin<C, FeedbackTypes> {
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

  async function createDiscussionThread(pageId: string, body: string): Promise<ActionResponse> {
    const octokit = await getOctokit();
    const repo = await getFeedbackRepository();
    const category = repo.discussionCategories.nodes.find(
      (category) => category.name === FeedbackCategory,
    );

    if (!category)
      throw new Response(`Please create a "${FeedbackCategory}" category in GitHub Discussion`, {
        status: 500,
      });

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

      return { githubUrl: result.addDiscussionComment.comment.url };
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

      return { githubUrl: result.createDiscussion.discussion.url };
    }
  }

  return feedbackPlugin<C>({
    beforeRequest: options.beforeRequest,
    async onPageFeedbackAction(feedback) {
      return createDiscussionThread(
        new URL(feedback.url).pathname,
        `[${feedback.opinion}] ${feedback.message}\n\n> Forwarded from user feedback.`,
      );
    },
    async onTextFeedbackAction(feedback) {
      const url = new URL(feedback.url);
      url.hash = feedback.blockId;

      return createDiscussionThread(
        url.pathname,
        `> ${feedback.blockBody}\n\n${feedback.message}\n\n> [Forwarded from user feedback](${url.href}).`,
      );
    },
  });
}
