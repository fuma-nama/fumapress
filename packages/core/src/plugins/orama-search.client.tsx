"use client";
import { lazy } from "react";
import type { StaticOptions } from "fumadocs-core/search/client/orama-static";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import { DefaultSearchDialog } from "../search.client";

/** the dialog of the exported Orama index, searched in the browser: a site searching on its server doesn't load the engine */
export const OramaSearchDialog = lazy(async () => {
  const { useStaticSearch } = await import("fumadocs-core/search/client/orama-static");

  return {
    default: function OramaSearchDialog({
      from,
      locale,
      ...props
    }: SharedProps & Pick<StaticOptions, "from" | "locale">) {
      return <DefaultSearchDialog {...props} {...useStaticSearch({ from, locale })} />;
    },
  };
});
