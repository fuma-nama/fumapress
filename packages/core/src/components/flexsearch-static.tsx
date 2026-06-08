"use client";
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
import { useDocsSearch } from "fumadocs-core/search/client";
import { flexsearchStaticClient } from "fumadocs-core/search/client/flexsearch-static";
import { useI18n } from "fumadocs-ui/contexts/i18n";
import { resolveBaseUrl } from "@/lib/pathname";

export default function DefaultSearchDialog(props: SharedProps) {
  const { locale } = useI18n();
  const { search, setSearch, query } = useDocsSearch({
    client: flexsearchStaticClient({
      locale,
      from: resolveBaseUrl(import.meta.env.BASE_URL, "/api/search"),
    }),
  });

  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== "empty" ? query.data : null} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
