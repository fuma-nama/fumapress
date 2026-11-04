"use client";
import { useStaticSearch, type StaticOptions } from "fumadocs-core/search/client/orama-static";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import { DefaultSearchDialog } from "../search.client";

/** the dialog of the exported Orama index, searched in the browser */
export function OramaSearchDialog({
  from,
  locale,
  ...props
}: SharedProps & Pick<StaticOptions, "from" | "locale">) {
  return <DefaultSearchDialog {...props} {...useStaticSearch({ from, locale })} />;
}
