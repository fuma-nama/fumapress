"use client";
import { useFlexsearchStatic } from "fumadocs-core/search/client/flexsearch-static";
import type { AppShape, LangEnv } from "../plugin";

/** the search of the exported FlexSearch index, in the browser */
export function useFlexsearchIndex({ from, lang }: { from: string } & LangEnv<AppShape>) {
  return useFlexsearchStatic({ from, locale: lang });
}
