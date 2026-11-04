"use client";
import { lazy } from "react";
import { useFetchSearch, type FetchOptions } from "fumadocs-core/search/client/fetch";
import type { SearchDialogProps, SharedProps } from "fumadocs-ui/components/dialog/search";

/** the Fumadocs dialog with its default parts, loaded apart from the page like the default dialog of Fumadocs */
export const DefaultSearchDialog = lazy(async () => {
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
    default: function DefaultSearchDialog(props: Omit<SearchDialogProps, "children">) {
      return (
        <SearchDialog {...props}>
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

/** the dialog of a search server */
export function FetchSearchDialog({
  api,
  locale,
  ...props
}: SharedProps & Pick<FetchOptions, "api" | "locale">) {
  return <DefaultSearchDialog {...props} {...useFetchSearch({ api, locale })} />;
}
