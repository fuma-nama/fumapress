import type { HTMLAttributes } from "vue";

export { fetchRepositoryInfo } from "./context";
export { default as GithubInfo } from "./GithubInfo.vue";

export interface FetchRepositoryInfoOptions {
  owner: string;
  repo: string;

  baseUrl?: string;
  token?: string;
  fetchOptions?: RequestInit;
}

export interface RepositoryInfo {
  stars: number;
  forks: number;
}

export interface GithubInfoProps extends FetchRepositoryInfoOptions {
  class?: HTMLAttributes["class"];
  locale?: Intl.LocalesArgument;
}
