"use client";
import { lazy } from "react";
import type { FlexsearchStaticOptions } from "fumadocs-core/search/client/flexsearch-static";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import { DefaultSearchDialog } from "../search.client";

/** the dialog of the exported FlexSearch index, searched in the browser: a site searching on its server doesn't load the engine */
export const FlexsearchDialog = lazy(async () => {
  const { useFlexsearchStatic } = await import("fumadocs-core/search/client/flexsearch-static");

  return {
    default: function FlexsearchDialog({
      from,
      locale,
      ...props
    }: SharedProps & Pick<FlexsearchStaticOptions, "from" | "locale">) {
      return <DefaultSearchDialog {...props} {...useFlexsearchStatic({ from, locale })} />;
    },
  };
});
