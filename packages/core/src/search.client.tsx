"use client";
import { createContext, lazy, use } from "react";
import type { UseSearchReturn } from "fumadocs-core/search/client";
import { useFetchSearch } from "fumadocs-core/search/client/fetch";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import type { AppShape, ClientHook, LangEnv } from "./plugin";
import type { ProviderProps } from "./press";

/** the search of a page: the client hook of the site's search plugin, in the page's language from the server */
export interface PressSearch extends LangEnv<AppShape> {
  client: ClientHook<UseSearchReturn, any>;
}

/** provided by the runtime around the root provider, without a search plugin it is `undefined` */
export const PressSearchContext = createContext<PressSearch | undefined>(undefined);

/** the search of the site's search plugin in the language of the page, for `ui.providerProps.search.SearchDialog` */
export function usePressSearch(): UseSearchReturn {
  const search = use(PressSearchContext);
  if (!search)
    throw new Error(
      "[Fumapress] `usePressSearch()` searches with a search plugin, the site has none.",
    );
  return search.client.hook({ ...search.client.props, lang: search.lang });
}

/** the Fumadocs dialog with `usePressSearch()`, loaded apart from the page like the default dialog of Fumadocs */
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
    default: function DefaultSearchDialog(props: SharedProps) {
      return (
        <SearchDialog {...usePressSearch()} {...props}>
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

/** the root provider's `search`: the default dialog with a search plugin or your dialog, disabled without either */
export function searchOptions(
  search: PressSearch | undefined,
  options: ProviderProps["search"],
): ProviderProps["search"] {
  return search || options?.SearchDialog
    ? { SearchDialog: DefaultSearchDialog, ...options }
    : { enabled: false, ...options };
}

/** the search of a search server, in the language of the page */
export function useServerSearch({ api, lang }: { api: string } & LangEnv<AppShape>) {
  return useFetchSearch({ api, locale: lang });
}
