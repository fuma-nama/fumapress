import { expect, test } from "vitest";
import { defaultGitProviderUrls, getFileUrl, getRepoUrl, type GitInfo } from "@/lib/git";

function info(overrides: Partial<GitInfo> = {}): GitInfo {
  const provider = overrides.provider ?? "github";

  return {
    provider,
    user: "fuma-nama",
    repo: "fumapress",
    branch: "dev",
    url: defaultGitProviderUrls[provider],
    ...overrides,
  };
}

test("github urls", () => {
  expect(getRepoUrl(info())).toBe("https://github.com/fuma-nama/fumapress");
  expect(getFileUrl(info(), "content/docs/index.mdx")).toBe(
    "https://github.com/fuma-nama/fumapress/blob/dev/content/docs/index.mdx",
  );
});

test("gitlab urls", () => {
  const git = info({ provider: "gitlab" });

  expect(getRepoUrl(git)).toBe("https://gitlab.com/fuma-nama/fumapress");
  expect(getFileUrl(git, "content/docs/index.mdx")).toBe(
    "https://gitlab.com/fuma-nama/fumapress/-/blob/dev/content/docs/index.mdx",
  );
});

test("bitbucket urls", () => {
  const git = info({ provider: "bitbucket" });

  expect(getRepoUrl(git)).toBe("https://bitbucket.org/fuma-nama/fumapress");
  expect(getFileUrl(git, "content/docs/index.mdx")).toBe(
    "https://bitbucket.org/fuma-nama/fumapress/src/dev/content/docs/index.mdx",
  );
});

test("self-hosted instance", () => {
  const git = info({ provider: "gitlab", url: "https://gitlab.example.com" });

  expect(getFileUrl(git, "index.mdx")).toBe(
    "https://gitlab.example.com/fuma-nama/fumapress/-/blob/dev/index.mdx",
  );
});
