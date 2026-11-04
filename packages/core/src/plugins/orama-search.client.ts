"use client";
import { useStaticSearch } from "fumadocs-core/search/client/orama-static";
import type { AppShape, LangEnv } from "../plugin";

/** the search of the exported Orama index, in the browser */
export function useOramaIndex({ from, lang }: { from: string } & LangEnv<AppShape>) {
  return useStaticSearch({ from, locale: lang });
}
