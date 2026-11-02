import { expect, test } from "vitest";
import type { SiteConfig } from "@/config";
import { createApp } from "./fixtures";

/** the repository link of layouts and the URL of a file, for `site.git` */
async function urls(git: Partial<NonNullable<SiteConfig["git"]>> = {}) {
  const ctx = await createApp({
    site: { git: { user: "fuma-nama", repo: "fumapress", branch: "dev", rootDir: "/", ...git } },
  });
  const { githubUrl, links = [] } = await ctx.defaultLayoutProps({ lang: undefined });
  const [link] = links;

  return {
    repo: githubUrl ?? (link?.type === "icon" ? link.url : undefined),
    file: ctx.getFileUrl("/content/docs/index.mdx"),
  };
}

test("github urls", async () => {
  expect(await urls()).toEqual({
    repo: "https://github.com/fuma-nama/fumapress",
    file: "https://github.com/fuma-nama/fumapress/blob/dev/content/docs/index.mdx",
  });
});

test("gitlab urls", async () => {
  expect(await urls({ provider: "gitlab" })).toEqual({
    repo: "https://gitlab.com/fuma-nama/fumapress",
    file: "https://gitlab.com/fuma-nama/fumapress/-/blob/dev/content/docs/index.mdx",
  });
});

test("bitbucket urls", async () => {
  expect(await urls({ provider: "bitbucket" })).toEqual({
    repo: "https://bitbucket.org/fuma-nama/fumapress",
    file: "https://bitbucket.org/fuma-nama/fumapress/src/dev/content/docs/index.mdx",
  });
});

test("self-hosted instance", async () => {
  const { file } = await urls({ provider: "gitlab", url: "https://gitlab.example.com/" });

  expect(file).toBe(
    "https://gitlab.example.com/fuma-nama/fumapress/-/blob/dev/content/docs/index.mdx",
  );
});
