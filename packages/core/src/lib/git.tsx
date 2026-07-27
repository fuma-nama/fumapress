import type { IconItemType } from "fumadocs-ui/layouts/shared";

export type GitProvider = "github" | "gitlab" | "bitbucket";

export interface GitInfo {
  provider: GitProvider;
  user: string;
  repo: string;
  branch: string;

  /** base URL of the git instance, without trailing slash */
  url: string;
}

/**
 * Brand icon paths from Simple Icons (https://simpleicons.org, CC0-1.0).
 */
const providers = {
  github: {
    label: "GitHub",
    url: "https://github.com",
    icon: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  },
  gitlab: {
    label: "GitLab",
    url: "https://gitlab.com",
    icon: "m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0537.8585.8585 0 0 0-.3361.4049L.4332 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.4617 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.4616-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0099-7.003z",
  },
  bitbucket: {
    label: "Bitbucket",
    url: "https://bitbucket.org",
    icon: "M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z",
  },
} satisfies Record<GitProvider, { label: string; url: string; icon: string }>;

export const defaultGitProviderUrls: Record<GitProvider, string> = {
  github: providers.github.url,
  gitlab: providers.gitlab.url,
  bitbucket: providers.bitbucket.url,
};

/** URL of the repository page */
export function getRepoUrl(git: GitInfo): string {
  return `${git.url}/${git.user}/${git.repo}`;
}

/**
 * A navbar icon link pointing to the repository, same as the one Fumadocs adds for `githubUrl`.
 */
export function getRepoLinkItem(git: GitInfo): IconItemType {
  const { label, icon } = providers[git.provider];

  return {
    type: "icon",
    url: getRepoUrl(git),
    text: label,
    label,
    icon: (
      <svg role="img" viewBox="0 0 24 24" fill="currentColor">
        <path d={icon} />
      </svg>
    ),
    external: true,
  };
}

/**
 * URL of a file in the repository.
 *
 * @param path - file path relative to the root directory of git repo, using `/` as separator.
 */
export function getFileUrl(git: GitInfo, path: string): string {
  const repo = getRepoUrl(git);

  switch (git.provider) {
    case "gitlab":
      return `${repo}/-/blob/${git.branch}/${path}`;
    case "bitbucket":
      return `${repo}/src/${git.branch}/${path}`;
    default:
      return `${repo}/blob/${git.branch}/${path}`;
  }
}
