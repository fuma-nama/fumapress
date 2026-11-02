import type { ComponentType } from "react";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { useI18n } from "fumadocs-ui/contexts/i18n";
import { useSearch } from "virtual:fumapress/layout";
import type { LayoutModule } from "../config";

type UseSearch = NonNullable<LayoutModule["useSearch"]>;

/** the provider hooks of search plugins, static indexes of `static` mode or the search server */
const engines = {
  flexsearch: async () =>
    (await import("fumadocs-core/search/client/flexsearch-static")).useFlexsearchStatic,
  orama: async () => (await import("fumadocs-core/search/client/orama-static")).useStaticSearch,
  fetch: async () => (await import("fumadocs-core/search/client/fetch")).useFetchSearch,
} satisfies Record<string, () => Promise<UseSearch>>;

export type SearchEngine = keyof typeof engines;

/** the default search dialog, with `useSearch` of the layout module, or the hook of `engine` */
export async function loadSearchDialog(
  engine: SearchEngine = "fetch",
): Promise<{ default: ComponentType<SharedProps> }> {
  const useEngine: UseSearch = useSearch ?? (await engines[engine]());

  function DefaultSearchDialog(props: SharedProps) {
    const { locale } = useI18n();

    return (
      <SearchDialog {...useEngine({ locale })} {...props}>
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
  }

  return { default: DefaultSearchDialog };
}
