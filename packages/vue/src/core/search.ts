import type { StructuredData } from "./types";

/** a page in the search index: the value of the search data route is a list of these */
export interface SearchEntry {
  url: string;
  title: string;
  description?: string;
  /** the headings of the page and the text under each, from `getPageStructuredData` */
  structuredData?: StructuredData;
}

/** a result as the search dialog lists it: a page, then its headings and texts that match */
export interface SearchResult {
  id: string;
  url: string;
  type: "page" | "heading" | "text";
  content: string;
}

const MAX_PAGES = 10;
const MAX_PER_PAGE = 4;

/**
 * Searches the index in the browser, so search needs no server. A text matches when it has every word of the query;
 * pages are ranked by where they match: their title first, then headings, then text.
 */
export function searchIndex(index: readonly SearchEntry[], query: string): SearchResult[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const matches = (text: string | undefined) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return words.every((word) => lower.includes(word));
  };

  const pages: { score: number; results: SearchResult[] }[] = [];
  for (const entry of index) {
    const { headings = [], contents = [] } = entry.structuredData ?? {};
    const inPage: SearchResult[] = [];
    let score = matches(entry.title) ? 100 : matches(entry.description) ? 20 : 0;

    for (const heading of headings) {
      if (!matches(heading.content)) continue;
      score += 10;
      inPage.push({
        id: `${entry.url}#${heading.id}`,
        url: `${entry.url}#${heading.id}`,
        type: "heading",
        content: heading.content,
      });
    }
    for (const [i, { heading, content }] of contents.entries()) {
      if (!matches(content)) continue;
      score += 1;
      inPage.push({
        id: `${entry.url}:${i}`,
        url: heading ? `${entry.url}#${heading}` : entry.url,
        type: "text",
        content,
      });
    }

    if (score === 0) continue;
    pages.push({
      score,
      results: [
        { id: entry.url, url: entry.url, type: "page", content: entry.title },
        ...inPage.slice(0, MAX_PER_PAGE),
      ],
    });
  }

  return pages
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PAGES)
    .flatMap((page) => page.results);
}
