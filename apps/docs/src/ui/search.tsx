"use client";
import { lazy } from "react";
import { usePathname } from "fumadocs-core/framework";
import { useFetchSearch, type FetchOptions } from "fumadocs-core/search/client/fetch";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import { frameworkOf } from "./framework";

/** searches the docs of the framework being read, and the pages outside of them */
export const DocsSearchDialog = lazy(async () => {
  const {
    SearchDialog,
    SearchDialogClose,
    SearchDialogContent,
    SearchDialogHeader,
    SearchDialogIcon,
    SearchDialogInput,
    SearchDialogList,
    SearchDialogOverlay,
  } = await import("fumadocs-ui/components/dialog/search");

  return {
    default: function DocsSearchDialog({
      api,
      locale,
      ...props
    }: SharedProps & Pick<FetchOptions, "api" | "locale">) {
      const framework = frameworkOf(usePathname());
      const search = useFetchSearch({
        api,
        locale,
        tag: framework && [framework, "site"],
      });

      return (
        <SearchDialog {...props} {...search}>
          <SearchDialogOverlay />
          <SearchDialogContent>
            <SearchDialogHeader>
              <SearchDialogIcon />
              <SearchDialogInput />
              <SearchDialogClose />
            </SearchDialogHeader>
            <SearchDialogList />
          </SearchDialogContent>
        </SearchDialog>
      );
    },
  };
});
