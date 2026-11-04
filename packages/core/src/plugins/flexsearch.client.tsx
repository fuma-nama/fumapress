"use client";
import {
  useFlexsearchStatic,
  type FlexsearchStaticOptions,
} from "fumadocs-core/search/client/flexsearch-static";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import { DefaultSearchDialog } from "../search.client";

/** the dialog of the exported FlexSearch index, searched in the browser */
export function FlexsearchDialog({
  from,
  locale,
  ...props
}: SharedProps & Pick<FlexsearchStaticOptions, "from" | "locale">) {
  return <DefaultSearchDialog {...props} {...useFlexsearchStatic({ from, locale })} />;
}
