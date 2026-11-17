import type { FetchRepositoryInfoOptions, RepositoryInfo } from "./index";

export async function fetchRepositoryInfo({
  owner,
  repo,
  token,
  baseUrl = "https://api.github.com",
  fetchOptions = {
    // default revalidate options for Next.js (optional)
    next: {
      revalidate: 60,
    },
  } as RequestInit,
}: FetchRepositoryInfoOptions): Promise<RepositoryInfo> {
  const endpoint = `${baseUrl}/repos/${owner}/${repo}`;
  const headers = new Headers(fetchOptions.headers);

  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(endpoint, {
    ...fetchOptions,
    headers,
  } as RequestInit);

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`Failed to fetch repository data: ${message}`);
  }

  const data = await response.json();
  return {
    stars: data.stargazers_count,
    forks: data.forks_count,
  };
}

/**
 * Uses compact notation (e.g., 1.5K, 2.3M).
 */
export const formatterOptions: Intl.NumberFormatOptions = {
  notation: "compact",
  maximumFractionDigits: 1,
};

export const defaultFormatter = new Intl.NumberFormat(undefined, formatterOptions);

export const promises: Record<string, Promise<RepositoryInfo>> = {};
